import { define, esc, TheElement, when } from '../core/the-element';

/**
 * <the-mail-health api="https://intaxing.in" endpoint="/api/isuper/email-template/campaign" refresh="60" compact>
 *
 * The app's mail at a glance, for an admin banner: is everything sending, which accounts are
 * paused or cooling down (and when they come back), today's sends against the cap, the last 7
 * days' bounce and complaint rates against the safe limits, and the latest alerts.
 *
 * Backend: GET {endpoint}/v1/health → the_campaign GET /v1/health (the host forwards it with its key).
 * Attributes: refresh (seconds, 0 = no auto refresh), compact (one line only, for a page header).
 * Event: the-health {ok, paused, cooling_down} after every load, so the host can show a badge.
 */

interface Health {
  ok: boolean;
  business: { name: string; status: string; pause_reason: string | null; total_cap: number };
  today: { sent: number; cap: number; remaining: number };
  last_7_days: { sent: number; hard_bounce: number; spam: number; spam_rate: number; hard_bounce_rate: number };
  accounts: {
    id: string;
    name: string;
    status: string;
    pause_reason: string | null;
    resume_at: string | null;
    ramp_level: number | null;
    per_day: number | null;
    sent_today: number;
  }[];
  paused: number;
  cooling_down: number;
  alerts: { text: string; at: string }[];
}
interface State {
  h: Health | null;
  error: string;
  loading: boolean;
  allAlerts: boolean;
}

/** Same limits as the_campaign's health check: under these is safe, from these it holds or cuts. */
const SAFE = { bounce: 0.02, spam: 0.001 };

const pct = (x: number, digits = 1) => `${(100 * x).toFixed(digits)}%`;

export class TheMailHealth extends TheElement<State> {
  protected state: State = { h: null, error: '', loading: false, allAlerts: false };
  private timer: ReturnType<typeof setInterval> | undefined;

  protected override actions = {
    reload: () => this.load(),
    toggleAlerts: () => this.set({ allAlerts: !this.state.allAlerts }),
  };

  static get observedAttributes() {
    return ['refresh'];
  }

  attributeChangedCallback() {
    this.schedule();
  }

  disconnectedCallback() {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.schedule();
  }

  private schedule() {
    clearInterval(this.timer);
    const s = Number(this.getAttribute('refresh') ?? 0);
    if (s > 0 && this.isConnected) this.timer = setInterval(() => this.load().catch((e) => this.fail(e)), Math.max(15, s) * 1000);
  }

  private endpoint() {
    return (this.getAttribute('endpoint') ?? '/api/isuper/email-template/campaign').replace(/\/+$/, '');
  }

  protected override async init() {
    await this.load();
  }

  private async load() {
    this.set({ loading: true });
    const h = await this.api().get<Health>(`${this.endpoint()}/v1/health`);
    this.set({ h, loading: false, error: '' });
    this.emit('the-health', { ok: h.ok, paused: h.paused, cooling_down: h.cooling_down });
  }

  protected override styles() {
    return `
      .banner { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--_good); flex: none; }
      .dot.warn { background: var(--_warn); } .dot.bad { background: var(--_bad); }
      .acc { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; padding: 8px 0; border-top: 1px solid var(--_border); }
      .alert { font-size: 13px; padding: 6px 0; border-top: 1px solid var(--_border); }
      .num { font-size: 18px; font-weight: 600; }
    `;
  }

  private headline(h: Health): { cls: string; text: string } {
    if (h.business.status !== 'active') {
      return { cls: 'bad', text: `Sending is paused for ${h.business.name}: ${h.business.pause_reason ?? 'paused'}` };
    }
    if (h.paused) {
      const back = h.cooling_down ? `, ${h.cooling_down} cooling down (come back by themselves)` : '';
      const manual = h.paused - h.cooling_down;
      return { cls: manual ? 'bad' : 'warn', text: `${h.paused} account${h.paused > 1 ? 's' : ''} paused${back}${manual ? `, ${manual} need you` : ''}` };
    }
    if (!h.accounts.length) return { cls: 'warn', text: 'No sending accounts yet' };
    return { cls: '', text: `All ${h.accounts.length} account${h.accounts.length > 1 ? 's' : ''} sending` };
  }

  protected view(): string {
    const s = this.state;
    const h = s.h;
    if (!h) return `<div class="card">${this.errorView() || '<span class="muted">Loading mail health…</span>'}</div>`;
    const top = this.headline(h);
    const w = h.last_7_days;
    const banner = `<div class="banner"><span class="dot ${top.cls}"></span><b>${esc(top.text)}</b>
      <span class="muted">· today ${h.today.sent} of ${h.today.cap}</span>
      ${w.sent ? `<span class="muted">· 7 days: bounces <span class="${w.hard_bounce_rate >= SAFE.bounce ? 'warn' : 'good'}">${pct(w.hard_bounce_rate)}</span>, complaints <span class="${w.spam_rate >= SAFE.spam ? 'warn' : 'good'}">${pct(w.spam_rate, 2)}</span></span>` : ''}
      <span class="spread"></span><button class="link" data-action="reload" ${s.loading ? 'disabled' : ''}>${s.loading ? 'Loading…' : 'Refresh'}</button></div>`;
    if (this.hasAttribute('compact')) return `<div class="card">${banner}${this.errorView()}</div>`;

    const accounts = h.accounts.map((a) => `
      <div class="acc"><div><b>${esc(a.name)}</b> <span class="chip ${a.status === 'active' ? 'good' : 'warn'}">${esc(a.status)}</span>
        ${a.pause_reason ? `<div class="muted">${esc(a.pause_reason)}</div>` : ''}
        ${a.status === 'paused' && a.resume_at ? `<div class="muted">back ${esc(when(a.resume_at))}</div>` : ''}</div>
        <div class="muted" style="text-align:right">${a.sent_today} today${a.ramp_level ? ` · warm-up ${a.ramp_level}` : ''}${a.per_day ? ` · max ${a.per_day}` : ''}</div></div>`).join('');
    const alerts = (s.allAlerts ? h.alerts : h.alerts.slice(0, 5)).map((x) =>
      `<div class="alert"><span class="muted">${esc(when(x.at))}</span> · ${esc(x.text)}</div>`
    ).join('');
    return `
<div class="card stack">
  ${banner}
  ${this.errorView()}
  <div class="grid">
    <div class="soft"><div class="muted">Sent today</div><div class="num">${h.today.sent}</div>
      <div class="bar"><span style="width:${Math.min(100, h.today.cap ? (100 * h.today.sent) / h.today.cap : 0)}%"></span></div>
      <div class="muted">${h.today.remaining} left of ${h.today.cap} · outreach cap ${h.business.total_cap}</div></div>
    <div class="soft"><div class="muted">Last 7 days</div><div class="num">${w.sent} sent</div>
      <div class="muted">${w.hard_bounce} bounces (${pct(w.hard_bounce_rate)}, safe under ${pct(SAFE.bounce, 0)}) · ${w.spam} complaints (${pct(w.spam_rate, 2)}, safe under ${pct(SAFE.spam)})</div></div>
  </div>
  ${h.accounts.length ? `<div><h4>Accounts</h4>${accounts}</div>` : ''}
  ${h.alerts.length ? `<div><h4>Alerts</h4>${alerts}${h.alerts.length > 5 ? `<button class="link" data-action="toggleAlerts">${s.allAlerts ? 'Fewer' : `All ${h.alerts.length}`}</button>` : ''}</div>` : ''}
</div>`;
  }
}

define('the-mail-health', TheMailHealth);
