# Handoff: the web components (2026-11-22)

Read this file, `README.md`, `docs/COMPONENTS.md` and `docs/intaxing-backend.php` first. Report what you
changed, what you tested and what you did not, then stop.

## Where things are

| Repo | Local | State |
|---|---|---|
| `puneetxp/the_web_component` | `/root/the_web_component` | branch `the-components`, **PR #1 open, not merged** (owner tests first) |
| `puneetxp/the_campaign` | `/root/the_campaign` | master, deployed on `ssh big` (`sudo ~/the_campaign/deploy/server/deploy.sh campaign`) |
| `puneetxp/intaxing23` | `/root/intaxing23` | **don't change it** for this work (shared with another agent; owner: "create it parallel") |

## What exists (PR #1)

- `src/core/`: `TheElement` base (state, `view()`, `set()`, `data-action` / `data-model`, `emit()`,
  `api()`), `TheApi` (host backend with the user's session: cookie + `X-Session-Id`, no keys in the
  browser), `THEME_CSS` (`--the-*` CSS variables, light/dark, shadow DOM).
- `src/mail/`: `<the-template-studio>` (AI picks / drafts templates; AI lives in the host app),
  `<the-mail-accounts>`, `<the-mail-health>`, `<the-mail-schedules>`, `<the-mail-log>`.
- `demo/` with a fake backend (`npm run demo`, `demo/mail-admin.html` = all on one page).
- `test/` vitest + happy-dom: 15 tests. `npm run check` (tsc), `npm run build:lib`
  (`dist-lib/the-web-components.js`, ~27 kB).
- `docs/intaxing-backend.php`: reference PHP for intaxing (not installed): `aiContext`, `aiChoose`
  (template studio) and `campaignProxy` (allow-listed `/v1/*` forwarding to the_campaign).
  `<the-mail-accounts>` already works with intaxing's live `/api/isuper/email-template/campaign/providers…`.

the_campaign endpoints the components use are live: `/v1/presets`, `/v1/providers…`, `/v1/health`,
`/v1/schedules`, `/v1/templates`, `/v1/sends?email=&status=&provider=&schedule=`, `/v1/events`,
`/v1/suppressions?email=`.

## Rules

- Git as `puneetxp <puneetsharma9@hotmail.com>`; a branch per change; PR; the owner merges web
  components after testing; no force-push.
- Components: framework-free TypeScript, no npm runtime dependencies; data in `state`, markup from
  `view()` with every value through `esc()`; results as `the-*` events; server calls only to the host
  app's backend (`this.api()`), never keys in attributes; look only from `--the-*` variables.
- Don't name members like built-in element members (`role`, `remove`, `title`, `hidden`, `id`…).
  intaxing's tsconfig uses `noImplicitOverride`: write `override` on `actions`, `init`, `styles`.
- Each component: a demo page with the fake backend (`demo/mock-backend.js`) and tests in `test/`.
- intaxing follows the owner's "the framework" skill (`/root/intaxing23/.claude/skills/the-framework`):
  custom routes in `php/Routes/pre/web.php`, then `php php/set.php`; never hand-edit generated files.
- Mail rules (from the owner): accounts at 80% of their free limits, outreach total cap 300/day to
  start (max 1,500), sender `hello@<domain>` for outreach, `noreply@` only for app mail; no DNS changes.

## Next (ask the owner which)

1. Owner tests PR #1 (`npm install && npm run demo`); fix what they find; they merge.
2. When the owner says so: install in intaxing on its own branch: the two AI endpoints and
   `campaignProxy` from `docs/intaxing-backend.php`, then replace the Angular Mail accounts box with
   `<the-mail-accounts>` and add `<the-mail-health>`, `<the-mail-schedules>`, `<the-mail-log>`,
   `<the-template-studio>` to Admin > Email Templates (load the built file or import `src/index.ts`,
   `CUSTOM_ELEMENTS_SCHEMA`).
3. Serve `dist-lib/the-web-components.js` from one place (the_campaign `/ui/…` or a CDN tag) so every
   app loads the same version; then INTAX (the_billing, SolidJS) and 0op.
4. More components as the owner asks (the plan: many components for many kinds of things).

Not tested yet: a real browser (no Chrome on the build machine; try `npx playwright install chromium`),
the PHP endpoints against intaxing's real AI, and real provider logins.
