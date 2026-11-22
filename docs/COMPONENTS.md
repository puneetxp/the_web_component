# the web components

Framework-free custom elements (plain TypeScript, no Angular / Solid / React inside), so the
same component works in intaxing (Angular), INTAX (SolidJS), 0op (Go pages) or plain HTML.
Every app loads the same built file, `dist-lib/the-web-components.js`.

```
src/core/the-element.ts   base class: state, view(), set(), data-action / data-model hooks, emit(), api()
src/core/api.ts           calls the host app's backend with the user's session (no keys in the browser)
src/core/theme.ts         shared look; colours, radius, font from CSS variables
src/mail/              mail components (the-template-studio, …)
src/index.ts          registers everything
```

## Using one

```html
<the-template-studio api="https://intaxing.in"></the-template-studio>
<script type="module">
  const el = document.querySelector("the-template-studio");
  el.addEventListener("the-use-template", (e) => openEditor(e.detail.id));
  el.addEventListener("the-save-draft", (e) => saveTemplate(e.detail));
</script>
```

In Angular: load the built file (or import `src/index.ts`), add `CUSTOM_ELEMENTS_SCHEMA` to the
host component, and bind events as `(the-save-draft)="save($event)"`. In SolidJS / plain HTML:
`addEventListener("the-save-draft", …)`.

Attributes every component understands: `api` (backend base URL, default same site),
`session-key` (localStorage key sent as `X-Session-Id`, default `session_id`), `theme`
(`light` / `dark`, default follows the system).

## Look per app

Only CSS variables change; the rest is inside the component's shadow DOM:

```css
the-template-studio {
  --the-primary: #4f46e5;   --the-on-primary: #fff;
  --the-surface: #fff;      --the-surface-2: #f8fafc;
  --the-text: #0f172a;      --the-muted: #64748b;   --the-border: #e2e8f0;
  --the-radius: 12px;       --the-font: Inter, sans-serif;
  /* dark: --the-surface-dark, --the-surface-2-dark, --the-text-dark, --the-muted-dark, --the-border-dark */
}
```

## Writing a new component

```ts
import { define, esc, TheElement } from "../core/the-element";

class TheHello extends TheElement<{ name: string; error: string }> {
  protected state = { name: "", error: "" };
  protected override actions = { greet: () => this.emit("the-greet", { name: this.state.name }) };
  protected view() {
    return `<div class="card row"><input data-model="name" value="${esc(this.state.name)}">
      <button class="primary" data-action="greet">Greet</button></div>${this.errorView()}`;
  }
}
define("the-hello", TheHello);
```

Rules: data in `state`, markup from `view()` (escape every value with `esc`), changes through
`set()`, results to the host as `the-…` events, server calls through `this.api()` to the host's
own backend. No keys in attributes.
