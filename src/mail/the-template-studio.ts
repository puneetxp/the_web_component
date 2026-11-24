import { define, esc, options, TheElement } from '../core/the-element';

/**
 * <the-template-studio api="https://intaxing.in">
 *
 * AI template studio: say who the mail is for and what it should do; the AI ranks the existing
 * templates for that audience (score and reason) or drafts a new email; preview it, then hand it
 * to the host app.
 *
 * Backend (the host app's, with the user's session):
 *   GET  /api/isuper/email-template/ai-context   audiences, goals, industries, templates, AI quota
 *   POST /api/isuper/email-template/ai-choose    {source, category, goal, service, notes} → ranking
 *   POST /api/isuper/email/ai-template           {prompt, current} → {email: {subject, heading, …}}
 *
 * Events (the host decides what they do):
 *   the-use-template  {id}                         open / use an existing template
 *   the-save-draft    {name, subject, fields}      save the AI draft as a new template
 *
 * Apps without AI can still use it: "Find the best template" needs the AI; the rest of the
 * component then shows why (ai.ready = false).
 */

interface Context {
  sources: Record<string, string>;
  goals: Record<string, string>;
  categories: string[];
  templates: { id: number; key?: string; name: string; subject: string; enabled: boolean; summary: string }[];
  ai: { ready: boolean; remaining_today: number; daily_limit: number; provider: string; model: string | null };
}
interface Ranked {
  id: number;
  name: string;
  score: number;
  reason: string;
}
interface Choice {
  best_id: number | null;
  ranking: Ranked[];
  advice: string;
  draft_prompt: string;
}
interface Draft {
  subject: string;
  heading: string;
  message: string;
  highlight: string;
  buttonText: string;
  buttonLink: string;
  signoff: string;
}
interface State {
  ctx: Context | null;
  source: string;
  category: string;
  goal: string;
  service: string;
  notes: string;
  busy: '' | 'choose' | 'draft';
  error: string;
  choice: Choice | null;
  draft: Draft | null;
  draftName: string;
  saved: string;
}

const BASE = '/api/isuper';

export class TheTemplateStudio extends TheElement<State> {
  protected state: State = {
    ctx: null,
    source: 'gst_new',
    category: '',
    goal: 'intro',
    service: '',
    notes: '',
    busy: '',
    error: '',
    choice: null,
    draft: null,
    draftName: '',
    saved: '',
  };

  protected override actions = {
    choose: () => this.choose(),
    draft: () => this.writeDraft(),
    use: (el: HTMLElement) => {
      const id = Number(el.dataset['id']);
      const tpl = this.state.ctx?.templates.find((t) => t.id === id);
      this.emit('the-use-template', { id, key: tpl?.key || tpl?.name || '', name: tpl?.name || '' });
    },
    save: () => this.saveDraft(),
    discard: () => this.set({ draft: null, saved: '' }),
  };

  protected override async init() {
    const ctx = await this.api().get<Context>(`${BASE}/email-template/ai-context`);
    this.set({ ctx });
  }

  private audience() {
    const s = this.state;
    return { source: s.source, category: s.category, goal: s.goal, service: s.service.trim(), notes: s.notes.trim() };
  }

  private async choose() {
    this.set({ busy: 'choose', error: '', choice: null, saved: '' });
    const choice = await this.api().post<Choice>(`${BASE}/email-template/ai-choose`, this.audience());
    this.set({ busy: '', choice });
  }

  /** Prompt for a new mail: the AI's own suggestion when there is one, else built from the form. */
  private draftPrompt(): string {
    const s = this.state;
    const c = s.ctx!;
    if (s.choice?.draft_prompt) return s.choice.draft_prompt + (s.notes ? `\nNotes: ${s.notes}` : '');
    return [
      `Audience: ${c.sources[s.source]}${s.category ? `, industry: ${s.category}` : ''}.`,
      `Goal: ${c.goals[s.goal]}${s.service ? `: ${s.service}` : ''}.`,
      s.notes ? `Notes: ${s.notes}` : '',
      'Short, friendly first contact. No prices, discounts, deadlines or penalties unless the notes give them.',
    ].filter(Boolean).join('\n');
  }

  private async writeDraft() {
    this.set({ busy: 'draft', error: '', saved: '' });
    const r = await this.api().post<{ email: Draft }>(`${BASE}/email/ai-template`, {
      prompt: this.draftPrompt(),
      current: this.state.draft ?? {},
    });
    const s = this.state;
    const name = s.draftName || ['ai', s.source, s.goal, s.category.split(/[ ,&/]+/)[0]?.toLowerCase()]
      .filter(Boolean).join('-');
    this.set({ busy: '', draft: r.email, draftName: name });
  }

  private saveDraft() {
    const s = this.state;
    if (!s.draft) return;
    const name = s.draftName.trim() || 'ai-draft';
    this.emit('the-save-draft', { name, subject: s.draft.subject, fields: s.draft });
    this.set({ saved: name });
  }

  protected override styles() {
    return `
      .rank { display: grid; grid-template-columns: 1fr auto; gap: 6px 12px; align-items: center; }
      .rank + .rank { border-top: 1px solid var(--_border); padding-top: 10px; margin-top: 10px; }
      .best { border-color: var(--_primary); }
      .mail-frame { background: #f1f5f9; border: 1px solid var(--_border); border-radius: calc(var(--_radius) - 2px); overflow: hidden; }
      .mail-meta { background: var(--_surface); border-bottom: 1px solid var(--_border); padding: 10px 14px; font-size: 12px; color: var(--_muted); display: grid; gap: 3px; }
      .mail-meta b { color: var(--_text); }
      .mail-wrap { padding: 14px; }
      .mail { background: #ffffff; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; max-width: 560px; margin: 0 auto; box-shadow: 0 1px 3px rgba(15,23,42,0.06); }
      .mail-hd { background: var(--_primary); color: var(--_on-primary); padding: 14px 18px; font-weight: 700; font-size: 15px; }
      .mail-bd { padding: 18px; }
      .mail-bd p { margin: 0 0 10px; white-space: pre-wrap; line-height: 1.6; font-size: 14px; color: #334155; }
      .mail-bd .heading { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 10px; }
      .mail .hl { background: #f8fafc; border-left: 4px solid var(--_primary); padding: 10px 12px; border-radius: 6px; margin: 12px 0; font-size: 13px; color: #1e293b; }
      .mail .btn { display: inline-block; background: var(--_primary); color: var(--_on-primary); padding: 9px 16px; border-radius: 7px; margin: 8px 0 12px; font-size: 13px; font-weight: 600; text-decoration: none; }
      .mail-ft { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 10px 18px; font-size: 11px; color: #64748b; }
    `;
  }

  protected view(): string {
    const s = this.state;
    const c = s.ctx;
    if (!c) return `<div class="card stack"><h3>AI template studio</h3>${this.errorView() || '<div class="muted">Loading…</div>'}</div>`;
    const aiLine = c.ai.ready
      ? `<span class="chip">AI: ${esc(c.ai.provider)}${c.ai.model ? ' · ' + esc(c.ai.model) : ''} · ${c.ai.remaining_today} left today</span>`
      : `<span class="chip warn">AI not set up: add a key in AI Settings</span>`;
    const canAi = c.ai.ready && c.ai.remaining_today > 0 && !s.busy;
    return `
<div class="card stack">
  <div class="row"><h3>AI template studio</h3><span class="spread"></span>${aiLine}</div>
  <div class="muted">Say who the mail is for. The AI compares your ${c.templates.length} templates for that audience, or writes a new one. Nothing is sent or saved until you choose.</div>
  <div class="grid">
    <label>Who is it for<select data-model="source">${options(c.sources, s.source)}</select></label>
    <label>Industry<select data-model="category"><option value="">Any industry</option>${options(c.categories, s.category)}</select></label>
    <label>Goal<select data-model="goal">${options(c.goals, s.goal)}</select></label>
    <label>Service (optional)<input data-model="service" value="${esc(s.service)}" placeholder="e.g. GST return filing"></label>
  </div>
  <label>Notes for the AI (optional)<textarea data-model="notes" placeholder="Offer, tone, anything true to mention">${esc(s.notes)}</textarea></label>
  <div class="row">
    <button class="primary" data-action="choose" ${canAi && c.templates.length ? '' : 'disabled'}>${s.busy === 'choose' ? 'Comparing…' : 'Find the best template'}</button>
    <button data-action="draft" ${canAi ? '' : 'disabled'}>${s.busy === 'draft' ? 'Writing…' : s.draft ? 'Write again' : 'Write a new one with AI'}</button>
  </div>
  ${this.errorView()}
  ${s.choice ? this.choiceView(s.choice) : ''}
  ${s.draft ? this.draftView(s.draft) : ''}
</div>`;
  }

  private choiceView(ch: Choice): string {
    const rows = ch.ranking.map((r) => `
      <div class="rank">
        <div><h4>${esc(r.name)}${r.id === ch.best_id ? ' <span class="chip good">best fit</span>' : ''}</h4>
          <div class="muted">${esc(r.reason)}</div>
          <div class="bar" title="${r.score} / 100"><span style="width:${r.score}%"></span></div></div>
        <div class="row"><span class="chip">${r.score}</span><button class="link" data-action="use" data-id="${r.id}">Open</button></div>
      </div>`).join('');
    return `
<div class="soft stack ${ch.best_id ? 'best' : ''}">
  <div class="notice info">${esc(ch.advice || (ch.best_id ? 'An existing template fits.' : 'No template fits well: write a new one.'))}</div>
  ${rows || '<div class="muted">No template fits this audience.</div>'}
  ${ch.best_id ? '' : '<div class="muted">"Write a new one with AI" uses the AI\'s suggestion for this audience.</div>'}
</div>`;
  }

  private draftView(d: Draft): string {
    const paras = d.message.split(/\n{2,}/).map((p) => `<p>${esc(p)}</p>`).join('');
    return `
<div class="soft stack">
  <div class="row"><h4>New email (draft preview)</h4><span class="spread"></span><span class="muted">Subject: ${esc(d.subject)}</span></div>
  <div class="mail-frame">
    <div class="mail-meta">
      <div>From: <b>INTAX Billing &lt;hello@intax.in&gt;</b></div>
      <div>Subject: <b>${esc(d.subject)}</b></div>
    </div>
    <div class="mail-wrap">
      <div class="mail">
        <div class="mail-hd">INTAX Billing</div>
        <div class="mail-bd">
          ${d.heading ? `<div class="heading">${esc(d.heading)}</div>` : ''}
          ${paras}
          ${d.highlight ? `<div class="hl">${esc(d.highlight)}</div>` : ''}
          ${d.buttonText ? `<span class="btn">${esc(d.buttonText)}</span>` : ''}
          ${d.signoff ? `<p style="margin-top:14px;color:#475569">${esc(d.signoff)}</p>` : ''}
        </div>
        <div class="mail-ft">Sent via INTAX Billing • GST Invoicing, Inventory &amp; Business Catalog</div>
      </div>
    </div>
  </div>
  <div class="row">
    <label class="spread">Template name<input data-model="draftName" value="${esc(this.state.draftName)}"></label>
    <button class="primary" data-action="save">Save as draft template</button>
    <button data-action="discard">Discard</button>
  </div>
  ${this.state.saved ? `<div class="notice info">Saved as "${esc(this.state.saved)}" (inactive). Check it in the editor, then switch it on.</div>` : ''}
</div>`;
  }
}

define('the-template-studio', TheTemplateStudio);
