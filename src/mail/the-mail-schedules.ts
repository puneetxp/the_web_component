import { define, esc, localDate, options, TheElement } from '../core/the-element';

/**
 * <the-mail-schedules api="https://intaxing.in" endpoint="/api/isuper/email-template/campaign">
 *
 * Outreach schedules in the_campaign: one template to a lead segment, sent at random times inside
 * a window, within each account's warm-up and the outreach cap (the_campaign decides how many a
 * day). Create one, see today's planned / queued / sent / failed and the next send, pause or
 * resume (pausing cancels today's queued mail; those leads are picked again later).
 *
 * Backend (the host forwards to the_campaign /v1 with its key):
 *   GET   {endpoint}/v1/schedules        GET {endpoint}/v1/templates
 *   POST  {endpoint}/v1/schedules        {template, filter, start_date, window, reserve}
 *   PATCH {endpoint}/v1/schedules/:id    {status}
 * Events: the-schedule-created {id, template}, the-schedule-changed {id, status, cancelled}.
 */

interface Schedule {
  id: string;
  template_key: string;
  status: 'active' | 'paused';
  start_date: string;
  reserve: number;
  filter: Record<string, unknown>;
  window: { days: number[]; from: string; to: string; timezone: string };
  today: { date: string; planned: number; queued: number; sent: number; failed: number; next_send: string | null };
}
interface Template {
  tpl_key: string;
  name: string;
  subject: string;
}
interface FacetRow {
  value: string;
  count: number;
}
interface Facets {
  total: number;
  never_mailed: number;
  categories: FacetRow[];
  states: FacetRow[];
  source_types: FacetRow[];
}
interface State {
  list: Schedule[] | null;
  templates: Template[];
  facets: Facets | null;
  error: string;
  notice: string;
  busy: string;
  adding: boolean;
  template: string;
  city: string;
  region: string;
  category: string;
  sourceType: string;
  q: string;
  minScore: string;
  maxScore: string;
  professionals: 'exclude' | 'include' | 'only';
  registeredFrom: string;
  registeredTo: string;
  neverMailed: boolean;
  cooldownDays: string;
  startDate: string;
  days: number[];
  from: string;
  to: string;
  reserve: string;
}

const DAY = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export class TheMailSchedules extends TheElement<State> {
  protected state: State = {
    list: null,
    templates: [],
    facets: null,
    error: '',
    notice: '',
    busy: '',
    adding: false,
    template: '',
    city: '',
    region: '',
    category: '',
    sourceType: '',
    q: '',
    minScore: '',
    maxScore: '',
    professionals: 'exclude',
    registeredFrom: '',
    registeredTo: '',
    neverMailed: true,
    cooldownDays: '365',
    startDate: localDate(),
    days: [1, 2, 3, 4, 5, 6],
    from: '09:00',
    to: '19:00',
    reserve: '40',
  };

  protected override actions = {
    toggleAdd: () => this.set({ adding: !this.state.adding, error: '', notice: '' }),
    day: (el: HTMLElement) => {
      const d = Number(el.dataset['day']);
      const days = this.state.days.includes(d) ? this.state.days.filter((x) => x !== d) : [...this.state.days, d].sort();
      this.set({ days });
    },
    create: () => this.create(),
    pause: (el: HTMLElement) => this.status(el.dataset['id']!, 'paused'),
    resume: (el: HTMLElement) => this.status(el.dataset['id']!, 'active'),
    reload: () => this.load(),
  };

  private endpoint() {
    return (this.getAttribute('endpoint') ?? '/api/isuper/email-template/campaign').replace(/\/+$/, '');
  }

  protected override async init() {
    await this.load();
  }

  /** Public method for host apps to refresh schedules, templates & lead facets. */
  public async reload() {
    await this.load();
  }

  /** Public method: sync templates from the_campaign and open the New Schedule form pre-filled. */
  public async openNewSchedule(opts: { template: string; sourceType?: string; category?: string }) {
    await this.load();
    this.set({
      adding: true,
      template: opts.template || this.state.template,
      sourceType: opts.sourceType !== undefined ? opts.sourceType : this.state.sourceType,
      category: opts.category !== undefined ? opts.category : this.state.category,
      error: '',
      notice: `Template "${opts.template}" synced from the_campaign. Set your lead filters and window below, then click Create schedule.`,
    });
  }

  private async load() {
    const api = this.api();
    const [s, t, facets] = await Promise.all([
      api.get<{ schedules: Schedule[] }>(`${this.endpoint()}/v1/schedules`),
      api.get<{ templates: Template[] }>(`${this.endpoint()}/v1/templates`),
      api.get<Facets>(`${this.endpoint()}/v1/leads/facets`).catch(() => null),
    ]);
    this.set({
      list: s.schedules ?? [],
      templates: t.templates ?? [],
      facets,
      template: this.state.template || t.templates?.[0]?.tpl_key || '',
    });
  }

  private async create() {
    const s = this.state;
    const filter: Record<string, unknown> = {};
    if (s.city.trim()) filter['city'] = s.city.trim();
    if (s.region.trim()) filter['state'] = s.region.trim();
    if (s.category.trim()) filter['category'] = s.category.trim();
    if (s.sourceType.trim()) filter['source_type'] = s.sourceType.trim();
    if (s.q.trim()) filter['q'] = s.q.trim();
    if (s.minScore.trim()) filter['min_score'] = Number(s.minScore);
    if (s.maxScore.trim()) filter['max_score'] = Number(s.maxScore);
    if (s.professionals === 'include') filter['include_professionals'] = true;
    if (s.professionals === 'only') filter['professionals_only'] = true;
    if (s.registeredFrom) filter['registered_from'] = s.registeredFrom;
    if (s.registeredTo) filter['registered_to'] = s.registeredTo;
    if (s.neverMailed) filter['never_mailed'] = true;
    if (s.cooldownDays.trim() !== '') filter['cooldown_days'] = Number(s.cooldownDays);
    this.set({ busy: 'create', error: '', notice: '' });
    const r = await this.api().post<{ schedule: Schedule }>(`${this.endpoint()}/v1/schedules`, {
      template: s.template,
      filter,
      start_date: s.startDate,
      window: { days: s.days, from: s.from, to: s.to },
      reserve: Number(s.reserve || 40),
    });
    this.emit('the-schedule-created', { id: r.schedule.id, template: r.schedule.template_key });
    this.set({ busy: '', adding: false, notice: `Schedule for "${r.schedule.template_key}" created. the_campaign plans it each morning.` });
    await this.load();
  }

  private async status(id: string, status: 'active' | 'paused') {
    this.set({ busy: id, error: '', notice: '' });
    const r = await this.api().patch<{ cancelled: number }>(`${this.endpoint()}/v1/schedules/${encodeURIComponent(id)}`, { status });
    this.emit('the-schedule-changed', { id, status, cancelled: r.cancelled ?? 0 });
    this.set({
      busy: '',
      notice: status === 'paused' ? `Paused; ${r.cancelled ?? 0} queued mails cancelled (those leads are picked again later).` : 'Resumed; it is planned again from tomorrow morning.',
    });
    await this.load();
  }

  protected override styles() {
    return `
      .sch { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; padding: 10px 0; border-top: 1px solid var(--_border); }
      .days button { padding: 4px 8px; min-width: 42px; }
      .days button.on { background: var(--_primary); color: var(--_on-primary); border-color: var(--_primary); }
      .stat { display: inline-block; margin-right: 10px; }
    `;
  }

  protected view(): string {
    const s = this.state;
    if (!s.list) return `<div class="card">${this.errorView() || '<span class="muted">Loading schedules…</span>'}</div>`;
    return `
<div class="card stack">
  <div class="row"><h3>Outreach schedules</h3><span class="spread"></span>
    <button class="link" data-action="reload">Refresh</button>
    <button class="${s.adding ? '' : 'primary'}" data-action="toggleAdd" ${s.templates.length ? '' : 'disabled'}>${s.adding ? 'Close' : 'New schedule'}</button></div>
  <div class="muted">the_campaign decides how many go each day (warm-up, caps, bounces) and spreads them over the window.</div>
  ${s.notice ? `<div class="notice info">${esc(s.notice)}</div>` : ''}
  ${this.errorView()}
  ${!s.templates.length ? '<div class="muted">No templates in the_campaign yet: save a template first.</div>' : ''}
  ${s.adding ? this.formView() : ''}
  ${s.list.length ? s.list.map((x) => this.rowView(x)).join('') : (s.adding ? '' : '<div class="muted">No schedules yet.</div>')}
</div>`;
  }

  private formView(): string {
    const s = this.state;
    const tpl = Object.fromEntries(s.templates.map((t) => [t.tpl_key, `${t.name} · ${t.subject}`]));
    const profOpts = {
      exclude: 'Exclude professionals (CA / tax)',
      include: 'Include professionals',
      only: 'Professionals only',
    };
    const datalist = (id: string, rows: FacetRow[] | undefined) =>
      `<datalist id="${id}">${(rows ?? []).map((r) => `<option value="${esc(r.value)}">${esc(r.value)} (${r.count})</option>`).join('')}</datalist>`;
    return `
<div class="soft stack">
  <label>Template<select data-model="template">${options(tpl, s.template)}</select></label>
  <div class="grid">
    <label>Professionals<select data-model="professionals">${options(profOpts, s.professionals)}</select></label>
    <label>Source (optional)<input list="tc-src-list" data-model="sourceType" value="${esc(s.sourceType)}" placeholder="e.g. MCA, GST"></label>
    <label>Registered from<input type="date" data-model="registeredFrom" value="${esc(s.registeredFrom)}"></label>
    <label>Registered to<input type="date" data-model="registeredTo" value="${esc(s.registeredTo)}"></label>
    <label>Category (optional)<input list="tc-cat-list" data-model="category" value="${esc(s.category)}" placeholder="e.g. Manufacturing & Industrial"></label>
    <label>State (optional)<input list="tc-state-list" data-model="region" value="${esc(s.region)}"></label>
    <label>City (optional)<input data-model="city" value="${esc(s.city)}"></label>
    <label>Keyword search (optional)<input data-model="q" value="${esc(s.q)}" placeholder="name, GSTIN, email..."></label>
    <label>Min. lead score<input type="number" min="0" max="100" data-model="minScore" value="${esc(s.minScore)}"></label>
    <label>Max. lead score<input type="number" min="0" max="100" data-model="maxScore" value="${esc(s.maxScore)}"></label>
    <label>Cross-business cooldown (days)<input type="number" min="0" max="3650" data-model="cooldownDays" value="${esc(s.cooldownDays)}"></label>
    <label class="row" style="align-items:center;gap:6px;padding-top:18px"><input type="checkbox" data-model="neverMailed" ${s.neverMailed ? 'checked' : ''} style="width:auto"> Never mailed only</label>
  </div>
  ${datalist('tc-cat-list', s.facets?.categories)}
  ${datalist('tc-state-list', s.facets?.states)}
  ${datalist('tc-src-list', s.facets?.source_types)}
  <div class="row days">${[1, 2, 3, 4, 5, 6, 7].map((d) =>
      `<button data-action="day" data-day="${d}" class="${s.days.includes(d) ? 'on' : ''}">${DAY[d]}</button>`
    ).join('')}</div>
  <div class="grid">
    <label>From<input type="time" data-model="from" value="${esc(s.from)}"></label>
    <label>To<input type="time" data-model="to" value="${esc(s.to)}"></label>
    <label>Start date<input type="date" data-model="startDate" value="${esc(s.startDate)}"></label>
    <label>Keep free for app mail (per account)<input type="number" min="0" data-model="reserve" value="${esc(s.reserve)}"></label>
  </div>
  <div class="row"><button class="primary" data-action="create" ${s.busy || !s.template || !s.days.length ? 'disabled' : ''}>${
      s.busy === 'create' ? 'Creating…' : 'Create schedule'
    }</button><span class="muted">${s.facets ? `${s.facets.never_mailed.toLocaleString()} never-mailed of ${s.facets.total.toLocaleString()} total leads.` : 'Leads that are blocked or already got this template are skipped.'}</span></div>
</div>`;
  }

  private rowView(x: Schedule): string {
    const f = Object.entries(x.filter ?? {}).map(([k, v]) => `${k.replace('_', ' ')}: ${v}`).join(', ') || 'all leads';
    const t = x.today;
    const busy = this.state.busy === x.id;
    return `
<div class="sch">
  <div><b>${esc(x.template_key)}</b> <span class="chip ${x.status === 'active' ? 'good' : 'warn'}">${x.status}</span>
    <div class="muted">${esc(f)} · ${x.window.days.map((d) => DAY[d]).join(' ')} ${esc(x.window.from)}–${esc(x.window.to)} · from ${esc(x.start_date)}</div>
    <div><span class="stat">today: <b>${t.planned}</b> planned</span><span class="stat">${t.queued} queued</span><span class="stat good">${t.sent} sent</span>${
      t.failed ? `<span class="stat warn">${t.failed} failed</span>` : ''
    }${t.next_send ? `<span class="muted">next ${esc(new Date(t.next_send).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }))}</span>` : ''}</div></div>
  <div>${x.status === 'active'
      ? `<button data-action="pause" data-id="${esc(x.id)}" ${busy ? 'disabled' : ''}>Pause</button>`
      : `<button class="primary" data-action="resume" data-id="${esc(x.id)}" ${busy ? 'disabled' : ''}>Resume</button>`}</div>
</div>`;
  }
}

define('the-mail-schedules', TheMailSchedules);
