import { define, esc, TheElement, when } from '../core/the-element';

/**
 * <the-mail-accounts api="https://intaxing.in" endpoint="/api/isuper/email-template/campaign">
 *
 * Sending accounts kept in the_campaign: pick the service (Brevo, Zoho, Hostinger, SendPulse…),
 * type the login and password, pick the sender type (its reason is shown), done. Host, port and a
 * careful daily limit come from the service. The list shows every account: sender, use, limit,
 * today's warm-up and sends, how bounces are seen, status (with cooldowns), and totals.
 *
 * Backend (the host app's, with the user's session; it adds the_campaign key on its side):
 *   GET  {endpoint}/providers          presets, sender_roles, domain, business, providers, total
 *   POST {endpoint}/providers          {preset, username, secret, from_email, from_name, purpose, per_day}
 *   POST {endpoint}/providers/update   {id, status | secret | per_day | from_email | from_name | purpose}
 *   POST {endpoint}/providers/test     {id, to?}  → {result: {ok, message}}
 *   POST {endpoint}/providers/remove   {id}
 * intaxing has these already (IsuperEmail_templateController::campaignProvider*).
 *
 * Events: the-account-added {id, name}, the-account-changed {id, status}, the-account-removed {id}.
 * The password goes to the backend once and is never shown again (only its last 4 characters).
 */

interface Preset {
  key: string;
  label: string;
  group: 'free' | 'mailbox' | 'paid' | 'other';
  kind: string;
  host: string | null;
  port: number | null;
  security: string | null;
  per_hour: number | null;
  per_day: number | null;
  purpose: string;
  free_plan: string | null;
  login_help: string;
  imap_host: string | null;
  notes: string;
}
interface SenderRole {
  key: string;
  label: string;
  address: string;
  name: string;
  purpose: string;
  reply_to: string | null;
  why: string;
  default_for: 'marketing' | 'transactional' | null;
}
interface Account {
  id: string;
  name: string;
  kind: string;
  preset: string | null;
  username: string | null;
  from_email: string | null;
  purpose: string;
  per_day: number | null;
  per_hour: number | null;
  status: 'active' | 'paused' | 'disabled';
  pause_reason: string | null;
  resume_at: string | null;
  secret_hint: string | null;
  ramp_level: number | null;
  ramp_start: number;
  imap_host: string | null;
  sent: { last_hour: number; today: number };
}
interface Totals {
  accounts: number;
  active: number;
  per_day: number;
  no_limit_set: string[];
  warmup_today: number;
  sent_today: number;
  total_cap: number;
  daily_cap: number;
}
interface Data {
  configured: boolean;
  presets: Preset[];
  sender_roles: SenderRole[];
  domain: string | null;
  business: string | null;
  providers: Account[];
  total: Totals | null;
}
interface State {
  data: Data | null;
  error: string;
  notice: string;
  busy: string;
  adding: boolean;
  showRemoved: boolean;
  preset: string;
  username: string;
  secret: string;
  role: string;
  signer: string;
  fromEmail: string;
  fromName: string;
  purpose: string;
  perDay: string;
  testTo: string;
}

const GROUPS: [Preset['group'], string][] = [
  ['free', 'Free sending services'],
  ['mailbox', 'Your own mailbox'],
  ['paid', 'Paid'],
  ['other', 'Other'],
];
const USE: Record<string, string> = { both: 'Both', transactional: 'App mail', marketing: 'Outreach' };

export class TheMailAccounts extends TheElement<State> {
  protected state: State = {
    data: null,
    error: '',
    notice: '',
    busy: '',
    adding: false,
    showRemoved: false,
    preset: '',
    username: '',
    secret: '',
    role: 'outreach',
    signer: '',
    fromEmail: '',
    fromName: '',
    purpose: 'both',
    perDay: '',
    testTo: '',
  };

  protected override actions = {
    toggleAdd: () => this.set({ adding: !this.state.adding, notice: '', error: '' }),
    toggleRemoved: () => this.set({ showRemoved: !this.state.showRemoved }),
    add: () => this.add(),
    test: (el: HTMLElement) => this.test(el.dataset['id']!),
    pause: (el: HTMLElement) => this.status(el.dataset['id']!, 'paused'),
    resume: (el: HTMLElement) => this.status(el.dataset['id']!, 'active'),
    remove: (el: HTMLElement) => this.removeAccount(el.dataset['id']!),
  };

  private endpoint(): string {
    return (this.getAttribute('endpoint') ?? '/api/isuper/email-template/campaign').replace(/\/+$/, '');
  }

  protected override async init() {
    // Selects re-draw the form (service → limits, sender type → address), so listen for changes.
    this.root.addEventListener('change', (e) => {
      const m = (e.target as HTMLElement).dataset?.['model'];
      if (m === 'preset') this.pickPreset();
      if (m === 'role') this.applyRole(true);
    });
    // Typing the signer's name updates the sender fields in place (no re-draw, so focus stays).
    this.root.addEventListener('input', (e) => {
      if ((e.target as HTMLElement).dataset?.['model'] !== 'signer') return;
      this.applyRole(false);
      for (const k of ['fromEmail', 'fromName'] as const) {
        const el = this.root.querySelector<HTMLInputElement>(`[data-model="${k}"]`);
        if (el) el.value = this.state[k];
      }
    });
    await this.load();
  }

  private async load() {
    const data = await this.api().get<Data>(`${this.endpoint()}/providers`);
    this.set({ data: { ...data, providers: data.providers ?? [], presets: data.presets ?? [], sender_roles: data.sender_roles ?? [] } });
  }

  private presetOf(key: string | null): Preset | undefined {
    return this.state.data?.presets.find((p) => p.key === key);
  }

  private senderRole(): SenderRole | undefined {
    return this.state.data?.sender_roles.find((r) => r.key === this.state.role);
  }

  /** Fills {domain}, {first}, {business} of a sender pattern. */
  private fill(pattern: string): string {
    const first = this.state.signer.trim() || 'Puneet';
    const d = this.state.data;
    return pattern
      .replace('{domain}', d?.domain || 'your-domain')
      .replace('{first}', pattern.includes('@') ? first.toLowerCase().replace(/[^a-z0-9.-]/g, '') : first)
      .replace('{business}', d?.business || 'your business');
  }

  private pickPreset() {
    const p = this.presetOf(this.state.preset);
    if (!p) return this.set({});
    const def = this.state.data!.sender_roles.find((r) =>
      r.default_for === (p.purpose === 'transactional' ? 'transactional' : 'marketing')
    );
    Object.assign(this.state, { purpose: p.purpose, perDay: p.per_day ? String(p.per_day) : '', role: def?.key ?? this.state.role });
    this.applyRole(true);
  }

  /** The sender type fills the address, the name and what the account is used for. */
  private applyRole(redraw: boolean) {
    const r = this.senderRole();
    if (r) {
      this.state.fromEmail = this.fill(r.address);
      this.state.fromName = this.fill(r.name);
      if (r.purpose !== 'both') this.state.purpose = r.purpose;
    }
    if (redraw) this.set({});
  }

  private async post(path: string, body: unknown) {
    return await this.api().post<any>(`${this.endpoint()}/providers${path}`, body);
  }

  private async add() {
    const s = this.state;
    const user = s.username.trim();
    this.set({ busy: 'add', error: '', notice: '' });
    const r = await this.post('', {
      preset: s.preset,
      username: user,
      secret: s.secret.trim(),
      from_email: s.fromEmail.trim() || (user.includes('@') ? user : ''),
      from_name: s.fromName.trim(),
      purpose: s.purpose,
      per_day: s.perDay.trim(),
    });
    const p = r?.provider;
    this.state.secret = '';
    const webhook = r?.webhook ? (r.webhook.ok ? ' Bounce webhook registered.' : ` ${r.webhook.message ?? ''}`) : '';
    this.set({ busy: '', adding: false, notice: `${p?.name ?? 'Account'} added. Press Test to check the login.${webhook}` });
    if (p) this.emit('the-account-added', { id: p.id, name: p.name });
    await this.load();
  }

  private label(a: Account) {
    return this.presetOf(a.preset)?.label ?? a.name;
  }

  private async test(id: string) {
    const a = this.state.data!.providers.find((x) => x.id === id)!;
    this.set({ busy: 'test:' + id, error: '', notice: '' });
    const to = this.state.testTo.trim();
    const r = await this.post('/test', to ? { id, to } : { id });
    const res = r?.result ?? r;
    this.set({ busy: '', ...(res?.ok ? { notice: `${this.label(a)}: ${res.message}` } : { error: `${this.label(a)}: ${res?.message ?? 'failed'}` }) });
  }

  private async status(id: string, status: 'active' | 'paused') {
    this.set({ busy: 'status:' + id, error: '' });
    await this.post('/update', { id, status });
    this.emit('the-account-changed', { id, status });
    this.set({ busy: '' });
    await this.load();
  }

  private async removeAccount(id: string) {
    const a = this.state.data!.providers.find((x) => x.id === id)!;
    if (!confirm(`Remove ${this.label(a)} (${a.from_email || a.username})? It stops sending; its history stays.`)) return;
    this.set({ busy: 'remove:' + id, error: '' });
    await this.post('/remove', { id });
    this.emit('the-account-removed', { id });
    this.set({ busy: '', notice: `${this.label(a)} removed.` });
    await this.load();
  }

  protected override styles() {
    return `
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th { text-align: left; font-weight: 600; color: var(--_muted); font-size: 12px; padding: 6px 8px 6px 0; }
      td { border-top: 1px solid var(--_border); padding: 8px 8px 8px 0; vertical-align: top; }
      td.n, th.n { text-align: right; }
      .scroll { overflow-x: auto; }
      .scroll table { min-width: 760px; }
      .why { border-left: 3px solid var(--_good); background: color-mix(in srgb, var(--_good) 8%, transparent); padding: 8px 10px; border-radius: 6px; font-size: 13px; }
      .status-paused { color: var(--_warn); } .status-disabled { color: var(--_muted); }
      .nowrap { white-space: nowrap; }
    `;
  }

  protected view(): string {
    const s = this.state;
    const d = s.data;
    if (!d) return `<div class="card stack"><h3>Mail accounts</h3>${this.errorView() || '<div class="muted">Loading…</div>'}</div>`;
    if (!d.configured) {
      return `<div class="card stack"><h3>Mail accounts</h3><div class="notice info">Connect the_campaign first (API URL and site key in its settings).</div></div>`;
    }
    const t = d.total;
    const totals = t
      ? `<span class="muted">${t.active} active of ${t.accounts} · limits add up to ${t.per_day} a day · warm-up allows ${t.warmup_today} today · ${t.sent_today} sent today · marketing cap ${t.total_cap} a day${
        t.no_limit_set.length ? ` · <span class="warn">no limit set: ${esc(t.no_limit_set.join(', '))}</span>` : ''
      }</span>`
      : '';
    const shown = d.providers.filter((a) => s.showRemoved || a.status !== 'disabled');
    const removed = d.providers.length - d.providers.filter((a) => a.status !== 'disabled').length;
    return `
<div class="card stack">
  <div class="row"><h3>Mail accounts</h3><span class="spread"></span>
    <button class="${s.adding ? '' : 'primary'}" data-action="toggleAdd">${s.adding ? 'Close' : 'Add account'}</button></div>
  ${totals}
  ${s.notice ? `<div class="notice info">${esc(s.notice)}</div>` : ''}
  ${this.errorView()}
  ${s.adding ? this.addView(d) : ''}
  ${shown.length ? this.listView(shown) : (s.adding ? '' : '<div class="muted">No accounts yet. Add one: pick the service, type the login and password.</div>')}
  ${removed ? `<div><button class="link" data-action="toggleRemoved">${s.showRemoved ? 'Hide' : 'Show'} ${removed} removed</button></div>` : ''}
</div>`;
  }

  private addView(d: Data): string {
    const s = this.state;
    const p = this.presetOf(s.preset);
    const groups = GROUPS.map(([g, label]) => {
      const items = d.presets.filter((x) => x.group === g);
      if (!items.length) return '';
      return `<optgroup label="${esc(label)}">${
        items.map((x) =>
          `<option value="${esc(x.key)}"${x.key === s.preset ? ' selected' : ''}>${esc(x.label)}${x.per_day ? ` · ${x.per_day}/day` : ''}</option>`
        ).join('')
      }</optgroup>`;
    }).join('');
    const role = this.senderRole();
    const brevo = p?.kind === 'brevo_api';
    return `
<div class="soft stack">
  <div class="grid">
    <label>Service<select data-model="preset"><option value="">Choose…</option>${groups}</select></label>
    <label>${brevo ? 'Account email (optional)' : 'Login'}<input data-model="username" value="${esc(s.username)}" autocomplete="off"></label>
    <label>${brevo ? 'API key (xkeysib-…)' : 'Password'}<input type="password" data-model="secret" autocomplete="new-password" value=""></label>
  </div>
  ${p ? `<div class="muted">${esc(p.login_help)}</div>` : ''}
  <div class="grid">
    <label>Sender type<select data-model="role">${
      d.sender_roles.map((r) => `<option value="${esc(r.key)}"${r.key === s.role ? ' selected' : ''}>${esc(r.label)}</option>`).join('')
    }</select></label>
    <label>Signed by (first name)<input data-model="signer" value="${esc(s.signer)}" placeholder="Puneet"></label>
    <label>Sender address<input data-model="fromEmail" value="${esc(s.fromEmail)}"></label>
    <label>Sender name<input data-model="fromName" value="${esc(s.fromName)}"></label>
    <label>Use for<select data-model="purpose">${
      Object.entries(USE).map(([v, l]) => `<option value="${v}"${v === s.purpose ? ' selected' : ''}>${l}</option>`).join('')
    }</select></label>
    <label>Max per day<input type="number" min="1" data-model="perDay" value="${esc(s.perDay)}"></label>
  </div>
  ${role ? `<div class="why"><b>Why ${esc(this.fill(role.address))}:</b> ${esc(role.why)}${
    role.reply_to ? ` Replies go to <b>${esc(this.fill(role.reply_to))}</b>.` : ''
  }</div>` : ''}
  ${p ? `<div class="muted">${p.host ? `${esc(p.host)}:${p.port} (${esc(p.security)}) · ` : ''}Free plan: ${esc(p.free_plan ?? 'none')} · Suggested max ${
    p.per_day ?? 'your own'
  } a day${p.per_hour ? `, ${p.per_hour} an hour` : ''}. ${esc(p.notes)} ${
    p.imap_host ? 'Bounces: read from this mailbox (IMAP).' : brevo ? 'Bounces: by webhook (registered automatically).' : 'Bounces: only refusals while sending are seen.'
  }</div>` : ''}
  <div class="row"><button class="primary" data-action="add" ${s.busy || !s.preset ? 'disabled' : ''}>${s.busy === 'add' ? 'Saving…' : 'Save account'}</button>
    <span class="muted">The password goes to the_campaign (stored encrypted) and is never shown again.</span></div>
</div>`;
  }

  private listView(list: Account[]): string {
    const s = this.state;
    const rows = list.map((a) => {
      const busy = s.busy.endsWith(':' + a.id);
      const bounces = a.imap_host ? 'mailbox' : a.kind === 'brevo_api' ? 'webhook' : 'refusals only';
      const resume = a.status === 'paused' && a.resume_at
        ? `<div class="muted">resumes ${esc(when(a.resume_at))}</div>`
        : '';
      return `<tr>
        <td>${esc(this.label(a))}<div class="muted">bounces: ${bounces}</div></td>
        <td>${esc(a.from_email || a.username || '')}<div class="muted">${esc(a.username ?? '')}${a.secret_hint ? ' · ' + esc(a.secret_hint) : ''}</div></td>
        <td>${esc(USE[a.purpose] ?? a.purpose)}</td>
        <td class="n">${a.per_day ?? '—'}${a.per_hour ? `<div class="muted">${a.per_hour}/h</div>` : ''}</td>
        <td class="n">${a.ramp_level ?? `<span class="muted">starts at ${a.ramp_start}</span>`}</td>
        <td class="n">${a.sent.today}</td>
        <td class="status-${a.status}">${a.status}${a.pause_reason ? `<div class="muted">${esc(a.pause_reason)}</div>` : ''}${resume}</td>
        <td class="nowrap">
          <button class="link" data-action="test" data-id="${esc(a.id)}" ${busy ? 'disabled' : ''}>Test</button>
          ${a.status === 'active' ? `<button class="link" data-action="pause" data-id="${esc(a.id)}" ${busy ? 'disabled' : ''}>Pause</button>` : ''}
          ${a.status === 'paused' ? `<button class="link" data-action="resume" data-id="${esc(a.id)}" ${busy ? 'disabled' : ''}>Resume</button>` : ''}
          ${a.status !== 'disabled' ? `<button class="link bad" data-action="remove" data-id="${esc(a.id)}" ${busy ? 'disabled' : ''}>Remove</button>` : ''}
        </td></tr>`;
    }).join('');
    return `
<div class="scroll"><table>
  <thead><tr><th>Service</th><th>Sender</th><th>Use for</th><th class="n">Max/day</th><th class="n">Warm-up today</th><th class="n">Sent today</th><th>Status</th><th></th></tr></thead>
  <tbody>${rows}</tbody>
</table></div>
<div class="row"><label class="spread">Test sends a real mail to (optional; empty = login check only)<input data-model="testTo" value="${esc(s.testTo)}" placeholder="you@example.com"></label></div>`;
  }
}

define('the-mail-accounts', TheMailAccounts);
