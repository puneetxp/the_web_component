import { TheApi } from './api';
import { THEME_CSS } from './theme';

/**
 * Base of every "the" web component (framework-free custom elements: work in Angular, SolidJS,
 * plain HTML or server pages alike).
 *
 * A component keeps its data in `state`, returns its markup from `view()`, and is re-drawn by
 * `set(patch)`. Markup hooks, so components need no listener code of their own:
 *   data-action="name"  click → this.actions.name(element)
 *   data-model="field"  input/change → this.state.field = value (no re-draw, so typing keeps focus)
 * Results go to the host app as DOM events (`emit`), so the host decides what they mean.
 *
 * Attributes every component understands:
 *   api="https://host"        base URL of the host app's backend (default: same site)
 *   session-key="session_id"  localStorage key of the session sent as X-Session-Id
 *   theme="light|dark"        force a theme (default: follows the system)
 */
export abstract class TheElement<S extends Record<string, any>> extends HTMLElement {
  protected root: ShadowRoot;
  protected abstract state: S;
  protected actions: Record<string, (el: HTMLElement) => void | Promise<void>> = {};
  private started = false;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
    this.root.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
      const fn = el && !(el as HTMLButtonElement).disabled ? this.actions[el.dataset['action']!] : undefined;
      if (fn) {
        e.preventDefault();
        Promise.resolve(fn.call(this, el!)).catch((err) => this.fail(err));
      }
    });
    const model = (e: Event) => {
      const el = e.target as HTMLInputElement;
      const key = el?.dataset?.['model'];
      if (key) (this.state as any)[key] = el.type === 'checkbox' ? el.checked : el.value;
    };
    this.root.addEventListener('input', model);
    this.root.addEventListener('change', model);
  }

  connectedCallback() {
    this.render();
    if (!this.started) {
      this.started = true;
      Promise.resolve(this.init()).catch((err) => this.fail(err));
    }
  }

  /** Runs once, when first added to the page (load data here). */
  protected init(): void | Promise<void> {}

  protected abstract view(): string;

  /** Extra CSS of this component (on top of the shared theme). */
  protected styles(): string {
    return '';
  }

  /** Merge into state and re-draw. */
  protected set(patch: Partial<S>) {
    Object.assign(this.state, patch);
    this.render();
  }

  protected render() {
    this.root.innerHTML = `<style>${THEME_CSS}${this.styles()}</style>${this.view()}`;
  }

  /** The host app's backend, called with the user's session. */
  protected api(): TheApi {
    return new TheApi(this.getAttribute('api') ?? '', this.getAttribute('session-key') ?? 'session_id');
  }

  /** Tells the host app something happened: `<the-x (the-something)="…">` in Angular. */
  protected emit<T>(name: string, detail: T) {
    this.dispatchEvent(new CustomEvent<T>(name, { detail, bubbles: true, composed: true }));
  }

  /** Shows an error; components put `${this.errorView()}` where errors belong. */
  protected fail(err: unknown) {
    this.set({ error: err instanceof Error ? err.message : String(err), busy: false } as any);
  }

  protected errorView(): string {
    const e = (this.state as any).error;
    return e ? `<div class="notice error">${esc(e)}</div>` : '';
  }
}

/** HTML-escape text for markup. */
export function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );
}

/** <option> list with one selected. */
export function options(items: Record<string, string> | string[], selected: string): string {
  const entries = Array.isArray(items) ? items.map((v) => [v, v]) : Object.entries(items);
  return entries.map(([v, l]) => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(l)}</option>`)
    .join('');
}

/** Registers a component once (safe when a bundle is loaded twice). */
export function define(tag: string, ctor: CustomElementConstructor) {
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}
