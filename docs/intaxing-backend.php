<?php
// Reference backend for <the-template-studio> in intaxing23 (PHP, the framework).
// Not installed anywhere yet. To add: paste these methods into
// php/App/Controller/Isuper/IsuperEmail_templateController.php, add the two routes below to
// $email_routes in php/Routes/pre/web.php, then run: php php/set.php
//
//     ['path' => '/email-template/ai-context', 'method' => 'GET', 'handler' => [\App\Controller\Isuper\IsuperEmail_templateController::class, 'aiContext']],
//     ['path' => '/email-template/ai-choose', 'method' => 'POST', 'handler' => [\App\Controller\Isuper\IsuperEmail_templateController::class, 'aiChoose']],

class IsuperEmail_templateController_StudioMethods {
    // ---- AI template studio (<the-template-studio> web component) ---------------------------

    /** Who a mail can be for; the AI uses these words to judge which template fits. */
    private const STUDIO_SOURCES = [
        'gst_new' => 'Newly registered GST businesses (registered in the last weeks)',
        'mca_new' => 'Newly incorporated companies / LLPs (MCA)',
        'existing' => 'Existing small businesses (registered long ago)',
        'any' => 'Any business owner',
    ];
    private const STUDIO_GOALS = [
        'intro' => 'Introduce InTaxing and its services',
        'service' => 'Offer one specific service',
        'compliance' => 'Remind about an upcoming compliance step',
        'followup' => 'Follow up after an earlier mail',
    ];

    private static function plainSummary(string $html, int $max = 600): string {
        $t = preg_replace('/<(style|script)[^>]*>.*?<\/\1>/is', ' ', $html) ?? $html;
        $t = trim(preg_replace('/\s+/', ' ', html_entity_decode(strip_tags($t), ENT_QUOTES | ENT_HTML5, 'UTF-8')) ?? '');
        return mb_substr($t, 0, $max);
    }

    /** GET /api/isuper/email-template/ai-context: audiences, goals, templates (short), AI quota. */
    public static function aiContext() {
        $templates = [];
        foreach ((array) Email_template::all()->array() as $r) {
            $r = (array) $r;
            $templates[] = ['id' => (int) $r['id'], 'name' => (string) $r['name'], 'subject' => (string) $r['subject'],
                'enabled' => (int) $r['enable'] === 1, 'summary' => self::plainSummary((string) $r['body'], 240)];
        }
        $q = \App\Provider\AiProvider::quotaStatus();
        return Response::json([
            'success' => true,
            'sources' => self::STUDIO_SOURCES,
            'goals' => self::STUDIO_GOALS,
            'categories' => \App\Provider\LeadFilter::CATEGORIES,
            'templates' => $templates,
            'ai' => ['ready' => (bool) $q['key_set'], 'remaining_today' => (int) $q['remaining_today'],
                'daily_limit' => (int) $q['daily_limit'], 'provider' => $q['provider'], 'model' => $q['model']],
        ]);
    }

    /**
     * POST /api/isuper/email-template/ai-choose {source, category, goal, service?, notes?}
     * One AI call: ranks the existing templates for this audience (score 0-100 with a reason),
     * says whether a new one is better, and writes the prompt for drafting it. Nothing is changed.
     */
    public static function aiChoose() {
        $raw = json_decode((string) file_get_contents('php://input'), true);
        $b = is_array($raw) ? $raw : $_POST;
        $source = array_key_exists((string) ($b['source'] ?? ''), self::STUDIO_SOURCES) ? (string) $b['source'] : 'any';
        $goal = array_key_exists((string) ($b['goal'] ?? ''), self::STUDIO_GOALS) ? (string) $b['goal'] : 'intro';
        $category = in_array((string) ($b['category'] ?? ''), \App\Provider\LeadFilter::CATEGORIES, true) ? (string) $b['category'] : '';
        $service = mb_substr(trim((string) ($b['service'] ?? '')), 0, 120);
        $notes = mb_substr(trim((string) ($b['notes'] ?? '')), 0, 800);

        $q = \App\Provider\AiProvider::quotaStatus();
        if (!$q['key_set']) {
            return Response::bad_req(['success' => false, 'message' => 'Save an OpenRouter or Gemini API key in AI Settings first.']);
        }
        if ($q['remaining_today'] <= 0) {
            return Response::bad_req(['success' => false, 'message' => "AI daily cap reached ({$q['used_today']}/{$q['daily_limit']})."]);
        }

        $list = [];
        $ids = [];
        foreach ((array) Email_template::all()->array() as $r) {
            $r = (array) $r;
            $ids[(int) $r['id']] = (string) $r['name'];
            $list[] = ['id' => (int) $r['id'], 'name' => (string) $r['name'], 'subject' => (string) $r['subject'],
                'active' => (int) $r['enable'] === 1, 'text' => self::plainSummary((string) $r['body'])];
        }

        $system = <<<SYS
You help InTaxing (an Indian CA-led firm: GST, income tax, accounting, payroll, ESIC/EPF, MCA/ROC
compliance, websites) choose which email template to send to an audience.

Judge each template only on: does its message fit this audience and goal, is it true for them
(for example "congratulations on your registration" is wrong for long-registered businesses), is
it short, specific and free of spam words. Prefer active templates.

Return JSON only:
{"ranking":[{"id":<template id>,"score":<0-100>,"reason":"<one sentence>"}],
 "best_id":<id of the best template, or null if none scores 70 or more>,
 "advice":"<one or two sentences: what to send, or why a new template is better>",
 "draft_prompt":"<instructions to write a better new email for this audience: audience, offer, tone; no prices, discounts, deadlines or penalties unless the notes give them>"}
Rank at most 5 templates, best first. Use only ids from the list.
SYS;
        $audience = [
            'audience' => self::STUDIO_SOURCES[$source],
            'industry' => $category ?: 'any',
            'goal' => self::STUDIO_GOALS[$goal] . ($service !== '' ? ": {$service}" : ''),
            'notes' => $notes,
        ];
        $user = "Audience and goal:\n" . json_encode($audience, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)
            . "\n\nTemplates:\n" . json_encode($list, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        try {
            $res = \App\Provider\AiProvider::chatJson($system, $user, null, 2048);
        } catch (\Throwable $e) {
            return Response::bad_req(['success' => false, 'message' => 'AI could not compare the templates: ' . $e->getMessage()]);
        }
        $d = is_array($res['data'] ?? null) ? $res['data'] : [];
        $ranking = [];
        foreach ((array) ($d['ranking'] ?? []) as $row) {
            $id = (int) ($row['id'] ?? 0);
            if (!isset($ids[$id]) || isset($ranking[$id])) {
                continue; // the AI may only name templates that exist
            }
            $ranking[$id] = ['id' => $id, 'name' => $ids[$id], 'score' => max(0, min(100, (int) ($row['score'] ?? 0))),
                'reason' => mb_substr(trim(strip_tags((string) ($row['reason'] ?? ''))), 0, 300)];
        }
        $ranking = array_values($ranking);
        usort($ranking, fn($a, $b) => $b['score'] <=> $a['score']);
        $best = (int) ($d['best_id'] ?? 0);
        $best = isset($ids[$best]) && ($ranking[0]['id'] ?? null) === $best && $ranking[0]['score'] >= 70 ? $best : null;
        return Response::json([
            'success' => true,
            'best_id' => $best,
            'ranking' => array_slice($ranking, 0, 5),
            'advice' => mb_substr(trim(strip_tags((string) ($d['advice'] ?? ''))), 0, 500),
            'draft_prompt' => mb_substr(trim(strip_tags((string) ($d['draft_prompt'] ?? ''))), 0, 1500),
            'model' => $res['model'] ?? null,
            'quota' => ['remaining_today' => (int) \App\Provider\AiProvider::quotaStatus()['remaining_today']],
        ]);
    }

}
