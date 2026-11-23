/**
 * Shared look of every "the" web component. Colours, radius and font come from CSS custom
 * properties, so each app changes only those:
 *
 *   the-template-studio { --the-primary: #4f46e5; --the-radius: 12px; --the-font: Inter, sans-serif; }
 *
 * Everything else lives inside the component (shadow DOM), so the host page can't break it.
 */
/**
 * Dark values. Status colours and links get lighter defaults, so they stay readable on a dark
 * card; each one can be set with its own `--the-*-dark` variable.
 */
const DARK = `
    --_surface: var(--the-surface-dark, #0f172a); --_surface-2: var(--the-surface-2-dark, #1e293b);
    --_text: var(--the-text-dark, #e2e8f0); --_muted: var(--the-muted-dark, #94a3b8); --_border: var(--the-border-dark, #334155);
    --_good: var(--the-good-dark, #34d399); --_warn: var(--the-warn-dark, #fbbf24); --_bad: var(--the-bad-dark, #f87171);
    --_link: var(--the-link-dark, color-mix(in srgb, var(--_primary) 45%, #ffffff));
  `;

export const THEME_CSS = `
:host {
  --_primary: var(--the-primary, #4f46e5);
  --_on-primary: var(--the-on-primary, #ffffff);
  --_surface: var(--the-surface, #ffffff);
  --_surface-2: var(--the-surface-2, #f8fafc);
  --_text: var(--the-text, #0f172a);
  --_muted: var(--the-muted, #64748b);
  --_border: var(--the-border, #e2e8f0);
  --_good: var(--the-good, #047857);
  --_warn: var(--the-warn, #b45309);
  --_bad: var(--the-bad, #b91c1c);
  --_link: var(--the-link, var(--_primary));
  --_radius: var(--the-radius, 12px);
  display: block;
  min-width: 0;
  max-width: 100%;
  font: 14px/1.45 var(--the-font, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
  color: var(--_text);
}
* { box-sizing: border-box; }
.card { background: var(--_surface); border: 1px solid var(--_border); border-radius: var(--_radius); padding: 14px; }
.soft { background: var(--_surface-2); border: 1px solid var(--_border); border-radius: calc(var(--_radius) - 4px); padding: 10px; }
.stack > * + * { margin-top: 10px; }
.row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); }
.spread { flex: 1; }
h3 { margin: 0; font-size: 15px; }
h4 { margin: 0 0 4px; font-size: 13px; }
.muted { color: var(--_muted); font-size: 12px; }
.good { color: var(--_good); } .warn { color: var(--_warn); } .bad { color: var(--_bad); }
label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--_muted); }
input, select, textarea {
  font: inherit; color: var(--_text); background: var(--_surface);
  border: 1px solid var(--_border); border-radius: calc(var(--_radius) - 4px); padding: 8px 10px; width: 100%;
}
textarea { resize: vertical; min-height: 64px; }
input:focus, select:focus, textarea:focus { outline: 2px solid color-mix(in srgb, var(--_primary) 35%, transparent); border-color: var(--_primary); }
button {
  font: inherit; cursor: pointer; border-radius: calc(var(--_radius) - 4px); padding: 8px 14px;
  border: 1px solid var(--_border); background: var(--_surface); color: var(--_text);
}
button.primary { background: var(--_primary); color: var(--_on-primary); border-color: var(--_primary); }
button.link { border: 0; background: none; color: var(--_link); padding: 4px 6px; }
button:disabled { opacity: .55; cursor: default; }
.notice { border-radius: calc(var(--_radius) - 4px); padding: 8px 10px; font-size: 13px; }
.notice.error { background: color-mix(in srgb, var(--_bad) 10%, transparent); color: var(--_bad); }
.notice.info { background: color-mix(in srgb, var(--_primary) 8%, transparent); }
.chip { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; border: 1px solid var(--_border); color: var(--_muted); }
.bar { height: 6px; border-radius: 3px; background: var(--_border); overflow: hidden; }
.bar > span { display: block; height: 100%; background: var(--_primary); }
@media (prefers-color-scheme: dark) {
  :host(:not([theme="light"])) {${DARK}}
}
:host([theme="dark"]) {${DARK}}
`;
