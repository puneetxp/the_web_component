# the_web_component

Framework-free web components (custom elements) for every app built on the "the" framework:
the same component works in intaxing (Angular), INTAX (SolidJS), 0op (Go pages) or plain HTML.
Each app only changes colours and fonts (CSS variables); behaviour stays the same.

| Component | What it does | Backend it needs |
|---|---|---|
| `<the-template-studio>` | AI template studio: pick the audience; the AI ranks your templates for it or drafts a new email; preview; hand it to the app | `docs/intaxing-backend.php` (2 endpoints) + the app's existing AI writer |
| `<the-mail-accounts>` | Sending accounts in the_campaign: pick the service, login + password, sender type with its reason; list with limits, warm-up, sends today, how bounces are seen, cooldowns; Test / Pause / Resume / Remove; totals | the host's proxy to the_campaign `/v1/providers` (intaxing has it: `/api/isuper/email-template/campaign/providers…`) |
| `<editable-list>`, `<wysiwyg-bs>` | the first prototypes (root of this repo) | none |

```bash
npm install
npm run demo        # demo pages with a fake backend, no app needed (demo/index.html)
npm test            # component tests (happy-dom)
npm run check       # TypeScript
npm run build:lib   # dist-lib/the-web-components.js: the one file apps load
```

How components are built (base class, events, theming, writing a new one): `docs/COMPONENTS.md`.

Rules shared by every component:
- No keys in the browser: a component calls its host app's own backend with the user's session.
- Results go to the host as `the-…` DOM events; the host decides what they do.
- Look comes only from `--the-…` CSS variables; everything else is inside the shadow DOM.
