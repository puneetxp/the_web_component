import { define, esc, TheElement, when } from '../core/the-element';

/**
 * <the-mail-log api="https://intaxing.in" endpoint="/api/isuper/email-template/campaign">
 *
 * What happened to the app's mail: the send log (filter by status, search one address), the
 * events (bounces, complaints, opens, alerts) and the block list. Searching an address answers
 * "did they get it, did it bounce, are they blocked and why" in one place.
 *
 * Backend (the host forwards to the_campaign /v1 with its key):
 *   GET {endpoint}/v1/sends?status=&email=     GET {endpoint}/v1/events?email=&event=
 *   GET {endpoint}/v1/suppressions?email=      DELETE {endpoint}/v1/suppressions/:email
 * Only addresses blocked by hand ("manual") can be unblocked here: unsubscribes, complaints and
 * bounces stay blocked (the law and the providers both expect that).
 * Event: the-unblocked {email}.
 */

interface Send {
  id: string;
  email: string;
  template_key: string;
  status: string;
  error: string | null;
  provider_id: string | null;
  purpose: string;
  schedule_id: string | null;
  due_at: string | null;
  created_at: string;
}
interface EventRow {
  send_id?: string | null;
  email: string;
  event: string;
  detail: string | null;
  created_at: string;
}
interface Block {
  business_id: string;
  email: string;
  reason: string;
  detail: string | null;
  created_at: string;
}
interface State {
  tab: 'sends' | 'events' | 'blocked';
  email: string;
  status: string;
  event: string;
  sends: Send[] | null;
  events: EventRow[] | null;
  blocked: Block[] | null;
  expandedSendId: string;
  error: string;
  notice: string;
  busy: boolean;
}

const STATUS: Record<string, string> = { '': 'All', queued: 'Queued', sent: 'Sent', failed: 'Failed', bounced: 'Bounced' };
const EVENTS: Record<string, string> = {
  '': 'All',
  delivered: 'Delivered',
  opened: 'Opened',
  click: 'Clicked',
  hard_bounce: 'Hard bounce',
  soft_bounce: 'Soft bounce',
  spam: 'Complaint',
  unsubscribed: 'Unsubscribed',
  alert: 'Alerts',
};
const REASON: Record<string, string> = {
  unsubscribed: 'Unsubscribed',
  complaint: 'Spam complaint',
  hard_bounce: 'Address does not exist (bounce)',
  invalid: 'Invalid / repeated soft bounces',
  manual: 'Blocked by hand',
};

export class TheMailLog extends TheElement<State> {
  protected state: State = {
    tab: 'sends',
    email: '',
    status: '',
    event: '',
    sends: null,
    events: null,
    blocked: null,
    expandedSendId: '',
    error: '',
    notice: '',
    busy: false,
  };

  protected override actions = {
    tab: (el: HTMLElement) => this.go(el.dataset['tab'] as State['tab']),
    search: () => this.load(),
    clear: () => {
      this.state.email = '';
      return this.load();
    },
    toggleSend: (el: HTMLElement) => {
      const id = el.dataset['id'] || '';
      this.set({ expandedSendId: this.state.expandedSendId === id ? '' : id });
    },
    unblock: (el: HTMLElement) => this.unblock(el.dataset['email']!),
  };

  private endpoint() {
    return (this.getAttribute('endpoint') ?? '/api/isuper/email-template/campaign').replace(/\/+$/, '');
  }

  protected override async init() {
    // Enter in the search box searches; changing a filter reloads.
    this.root.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter' && (e.target as HTMLElement).dataset?.['model'] === 'email') {
        this.load().catch((err) => this.fail(err));
      }
    });
    this.root.addEventListener('change', (e) => {
      const m = (e.target as HTMLElement).dataset?.['model'];
      if (m === 'status' || m === 'event') this.load().catch((err) => this.fail(err));
    });
    await this.load();
  }

  private async go(tab: State['tab']) {
    this.state.tab = tab;
    await this.load();
  }

  private qs(params: Record<string, string>) {
    const p = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
    const s = p.toString();
    return s ? `?${s}` : '';
  }

  private async load() {
    const s = this.state;
    const email = s.email.trim();
    this.set({ busy: true, error: '', notice: '' });
    const api = this.api();
    const base = this.endpoint();
    if (s.tab === 'sends') {
      const [r, ev, b] = await Promise.all([
        api.get<{ sends: Send[] }>(`${base}/v1/sends${this.qs({ status: s.status, email, limit: '100' })}`),
        api.get<{ events: EventRow[] }>(`${base}/v1/events${this.qs({ email, limit: '200' })}`).catch(() => ({ events: [] })),
        email ? api.get<{ suppressions: Block[] }>(`${base}/v1/suppressions${this.qs({ email })}`) : Promise.resolve(null),
      ]);
      this.set({ sends: r.sends ?? [], events: ev.events ?? s.events, blocked: b ? b.suppressions : s.blocked, busy: false });
    } else if (s.tab === 'events') {
      const r = await api.get<{ events: EventRow[] }>(`${base}/v1/events${this.qs({ event: s.event, email, limit: '100' })}`);
      this.set({ events: r.events ?? [], busy: false });
    } else {
      const r = await api.get<{ suppressions: Block[] }>(`${base}/v1/suppressions${this.qs({ email, limit: '200' })}`);
      this.set({ blocked: r.suppressions ?? [], busy: false });
    }
  }

  private async unblock(email: string) {
    if (!confirm(`Unblock ${email}? Only do this if they asked to receive mail again.`)) return;
    await this.api().delete(`${this.endpoint()}/v1/suppressions/${encodeURIComponent(email)}`);
    this.emit('the-unblocked', { email });
    await this.load();
    this.set({ notice: `${email} unblocked.` });
  }

  protected override styles() {
    return `
      .tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--_border); }
      .tabs button { border: 0; border-bottom: 2px solid transparent; border-radius: 0; background: none; color: var(--_muted); }
      .tabs button.on { color: var(--_text); border-bottom-color: var(--_primary); font-weight: 600; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th { text-align: left; font-weight: 600; color: var(--_muted); font-size: 12px; padding: 6px 8px 6px 0; }
      td { border-top: 1px solid var(--_border); padding: 7px 8px 7px 0; vertical-align: top; }
      .scroll { overflow-x: auto; }
      .scroll table { min-width: 560px; }
      td:first-child { white-space: nowrap; }
      .st-sent { color: var(--_good); } .st-failed, .st-bounced { color: var(--_bad); } .st-queued { color: var(--_muted); }
      .trk { display: inline-flex; flex-wrap: wrap; gap: 4px; margin-top: 3px; }
      .trk .open { color: var(--_good); border-color: color-mix(in srgb, var(--_good) 40%, var(--_border)); }
      .trk .deliv { color: var(--_link); border-color: color-mix(in srgb, var(--_link) 35%, var(--_border)); }
      .detail-row td { background: var(--_surface-2); padding: 10px 12px; }
      .tl { display: grid; gap: 6px; font-size: 12px; }
      .tl-item { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; }
      .tl-time { color: var(--_muted); min-width: 130px; font-variant-numeric: tabular-nums; }
      .tl-ev { font-weight: 600; color: var(--_text); }
    `;
  }

  protected view(): string {
    const s = this.state;
    const tab = (k: State['tab'], label: string) => `<button data-action="tab" data-tab="${k}" class="${s.tab === k ? 'on' : ''}">${label}</button>`;
    const filter = s.tab === 'sends'
      ? `<label>Status<select data-model="status">${Object.entries(STATUS).map(([v, l]) => `<option value="${v}"${v === s.status ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`
      : s.tab === 'events'
      ? `<label>Event<select data-model="event">${Object.entries(EVENTS).map(([v, l]) => `<option value="${v}"${v === s.event ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`
      : '';
    return `
<div class="card stack">
  <div class="row"><h3>Mail log</h3></div>
  <div class="tabs">${tab('sends', 'Sends')}${tab('events', 'Events')}${tab('blocked', 'Blocked')}</div>
  <div class="row">
    <label class="spread">Email address<input data-model="email" value="${esc(s.email)}" placeholder="Search one address (Enter)"></label>
    ${filter}
    <button class="primary" data-action="search" ${s.busy ? 'disabled' : ''}>${s.busy ? 'Loading…' : 'Search'}</button>
    ${s.email ? '<button class="link" data-action="clear">Clear</button>' : ''}
  </div>
  ${s.notice ? `<div class="notice info">${esc(s.notice)}</div>` : ''}
  ${this.errorView()}
  ${s.tab === 'sends' ? this.sendsView() : s.tab === 'events' ? this.eventsView() : this.blockedView(s.blocked)}
</div>`;
  }

  private blockNote(): string {
    const s = this.state;
    if (!s.email.trim() || !s.blocked) return '';
    if (!s.blocked.length) return `<div class="notice info">${esc(s.email)} is not blocked.</div>`;
    const b = s.blocked[0];
    return `<div class="notice error">${esc(b.email)} is blocked${b.business_id === '*' ? ' for every sender' : ''}: ${esc(REASON[b.reason] ?? b.reason)}${
      b.detail ? ` (${esc(b.detail)})` : ''
    }, since ${esc(when(b.created_at))}.</div>`;
  }

  private sendsView(): string {
    const list = this.state.sends;
    if (!list) return '<div class="muted">Loading…</div>';
    if (!list.length) return `${this.blockNote()}<div class="muted">No mail found.</div>`;
    const evs = this.state.events ?? [];
    const bySend = new Map<string, EventRow[]>();
    const byEmail = new Map<string, EventRow[]>();
    for (const e of evs) {
      if (e.send_id) {
        if (!bySend.has(e.send_id)) bySend.set(e.send_id, []);
        bySend.get(e.send_id)!.push(e);
      }
      if (e.email && e.email !== '-') {
        const em = e.email.toLowerCase();
        if (!byEmail.has(em)) byEmail.set(em, []);
        byEmail.get(em)!.push(e);
      }
    }
    const eventsFor = (x: Send): EventRow[] => {
      const exact = bySend.get(x.id);
      if (exact?.length) return exact;
      if (x.status === 'sent') return byEmail.get(x.email.toLowerCase()) ?? [];
      return [];
    };
    const trackBadges = (x: Send) => {
      const rows = eventsFor(x);
      if (!rows.length) return '';
      const deliv = rows.filter((r) => r.event === 'delivered');
      const opens = rows.filter((r) => r.event === 'opened' || r.event === 'unique_opened');
      const clicks = rows.filter((r) => r.event === 'click' || r.event === 'clicked');
      const out: string[] = [];
      if (deliv.length) out.push(`<span class="chip deliv">delivered · ${esc(when(deliv[0].created_at))}</span>`);
      if (opens.length) {
        const count = opens.length > 1 ? ` (${opens.length}×)` : '';
        out.push(`<span class="chip open">opened${count} · ${esc(when(opens[0].created_at))}</span>`);
      }
      if (clicks.length) {
        const count = clicks.length > 1 ? ` (${clicks.length}×)` : '';
        out.push(`<span class="chip open">clicked${count} · ${esc(when(clicks[0].created_at))}</span>`);
      }
      return out.length ? `<div class="trk">${out.join('')}</div>` : '';
    };
    const detailRow = (x: Send) => {
      if (this.state.expandedSendId !== x.id) return '';
      const rows = eventsFor(x)
        .slice()
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      const timeline = [
        `<div class="tl-item"><span class="tl-time">${esc(when(x.created_at))}</span><span class="tl-ev">${esc(x.status === 'queued' ? 'Queued' : 'Sent')}</span><span class="muted">template: ${esc(x.template_key)}${x.provider_id ? ` · account: ${esc(x.provider_id)}` : ''}</span></div>`,
        ...rows.map(
          (r) =>
            `<div class="tl-item"><span class="tl-time">${esc(when(r.created_at))}</span><span class="tl-ev">${esc(EVENTS[r.event] ?? r.event)}</span><span class="muted">${esc(r.detail ?? '')}</span></div>`,
        ),
      ];
      if (!rows.length && x.status === 'sent') {
        timeline.push('<div class="muted">No open or delivery events recorded yet for this send.</div>');
      }
      return `<tr class="detail-row"><td colspan="6"><div class="tl">${timeline.join('')}</div></td></tr>`;
    };
    return `${this.blockNote()}<div class="scroll"><table>
      <thead><tr><th>When</th><th>To</th><th>Template</th><th>Status &amp; Open Time</th><th>Kind</th><th></th></tr></thead><tbody>${
      list.map((x) => {
        const isOpen = this.state.expandedSendId === x.id;
        return `<tr><td>${esc(when(x.status === 'queued' && x.due_at ? x.due_at : x.created_at))}</td><td>${esc(x.email)}</td>
          <td>${esc(x.template_key)}</td><td class="st-${esc(x.status)}">${esc(x.status)}${trackBadges(x)}${x.error ? `<div class="muted">${esc(x.error)}</div>` : ''}</td>
          <td class="muted">${x.schedule_id ? 'scheduled' : esc(x.purpose)}</td>
          <td><button class="link" data-action="toggleSend" data-id="${esc(x.id)}">${isOpen ? 'Hide' : 'Timeline'}</button></td></tr>${detailRow(x)}`;
      }).join('')
    }</tbody></table></div>`;
  }

  private eventsView(): string {
    const list = this.state.events;
    if (!list) return '<div class="muted">Loading…</div>';
    if (!list.length) return '<div class="muted">No events.</div>';
    return `<div class="scroll"><table><thead><tr><th>When</th><th>Address</th><th>Event</th><th>Detail</th></tr></thead><tbody>${
      list.map((e) => `<tr><td>${esc(when(e.created_at))}</td><td>${e.email === '-' ? '' : esc(e.email)}</td>
        <td>${esc(EVENTS[e.event] ?? e.event)}</td><td class="muted">${esc(e.detail ?? '')}</td></tr>`).join('')
    }</tbody></table></div>`;
  }

  private blockedView(list: Block[] | null): string {
    if (!list) return '<div class="muted">Loading…</div>';
    if (!list.length) return '<div class="muted">Nobody is blocked.</div>';
    return `<div class="scroll"><table><thead><tr><th>Address</th><th>Why</th><th>Since</th><th></th></tr></thead><tbody>${
      list.map((b) => `<tr><td>${esc(b.email)}${b.business_id === '*' ? ' <span class="chip">every sender</span>' : ''}</td>
        <td>${esc(REASON[b.reason] ?? b.reason)}${b.detail ? `<div class="muted">${esc(b.detail)}</div>` : ''}</td>
        <td>${esc(when(b.created_at))}</td>
        <td>${b.reason === 'manual' && b.business_id !== '*' ? `<button class="link" data-action="unblock" data-email="${esc(b.email)}">Unblock</button>` : ''}</td></tr>`).join('')
    }</tbody></table></div>`;
  }
}

define('the-mail-log', TheMailLog);
