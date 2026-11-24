import { define, esc, TheElement } from '../core/the-element';
import {
  ACCENT_SWATCHES,
  applySampleMergeVars,
  buildSimpleTemplate,
  buildStandardTemplates,
  EmailTemplateFields,
  MERGE_VARIABLES,
  normalizeTemplateKey,
  renderEmailTemplateHtml,
  SAMPLE_LEAD,
  SiteBrandConfig,
  StandardTemplatePreset,
  TemplateLayout,
} from './mail-templates-data';

/**
 * <the-mail-templates
 *   endpoint="/api/isuper/mail/campaign"
 *   ai-endpoint="/api/isuper/email/ai-template"
 *   test-endpoint="/api/isuper/mail/send-test"
 *   brand="INTAX Billing"
 *   site-url="https://intax.in"
 *   from="INTAX Billing <hello@intax.in>"
 *   accent="#dc2626"
 *   theme="light"
 * />
 *
 * Framework-free email template workbench reusable on any site:
 *   - 5 Standard Templates with live look-and-feel preview (Desktop/Mobile, Sample Data, HTML)
 *   - 1 Simple Customizable Template where anyone sets values themselves + built-in AI assistant
 *   - Saved Templates viewer (loads full HTML from the_campaign, preview, test-send, delete)
 *
 * Public methods:
 *   el.reload()             refresh saved templates from the_campaign
 *   el.openTemplate(key)    switch to Saved tab and preview that template
 *
 * Events:
 *   the-template-saved      { key, name, subject }
 *   the-template-deleted    { key }
 *   the-schedule-template   { key, name, subject, sourceType? }
 */

interface SavedTemplateSummary {
  tpl_key: string;
  name: string;
  subject: string;
  tag?: string;
}

interface SavedTemplateDetail extends SavedTemplateSummary {
  html: string;
}

type TabMode = 'standard' | 'simple' | 'saved';
type ViewportMode = 'desktop' | 'mobile';

interface State {
  tab: TabMode;
  viewport: ViewportMode;
  renderSample: boolean;
  showCode: boolean;
  standards: StandardTemplatePreset[];
  selectedStdId: string;
  simple: EmailTemplateFields;
  aiPrompt: string;
  testEmail: string;
  savedList: SavedTemplateSummary[] | null;
  selectedSavedKey: string;
  savedDetail: SavedTemplateDetail | null;
  loadingDetail: boolean;
  busy: string;
  notice: string;
  error: string;
}

const AI_QUICK_PROMPTS = [
  { label: 'All-in-one (Site + Services + Billing)', prompt: 'Write a warm, clear overview email introducing our all-in-one platform: GST billing, inventory, e-commerce website, business portfolio website, and online service listings in one place.' },
  { label: 'E-commerce & Portfolio site', prompt: 'Write a friendly outreach email offering a ready e-commerce website for selling products or a clean business portfolio website for showcasing services, connected to GST billing and inventory.' },
  { label: 'Festive offer', prompt: 'Write a friendly festive season offer inviting businesses to try our billing workspace with a quick setup walkthrough.' },
  { label: 'Make shorter', prompt: 'Keep the exact same meaning and variables, but make the email much shorter, crisper, and easier to scan.' },
  { label: 'More professional', prompt: 'Rewrite the current email in a polished, executive tone suitable for company directors and finance managers.' },
  { label: 'Stronger CTA', prompt: 'Keep the current topic, strengthen the highlight box and call-to-action button so more readers click or reply.' },
] as const;

export class TheMailTemplates extends TheElement<State> {
  protected state: State = {
    tab: 'standard',
    viewport: 'desktop',
    renderSample: true,
    showCode: false,
    standards: [],
    selectedStdId: 'std-all-services',
    simple: buildSimpleTemplate({
      brandName: 'INTAX Billing',
      siteUrl: 'https://intax.in',
      accentColor: '#dc2626',
      fromLabel: 'INTAX Billing <hello@intax.in>',
    }),
    aiPrompt: '',
    testEmail: '',
    savedList: null,
    selectedSavedKey: '',
    savedDetail: null,
    loadingDetail: false,
    busy: '',
    notice: '',
    error: '',
  };

  constructor() {
    super();
    const onSimpleInput = (e: Event) => {
      const el = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      const field = el?.dataset?.['simple'] as keyof EmailTemplateFields | undefined;
      if (!field) return;
      (this.state.simple as any)[field] = el.value;
      this.syncLivePreview();
    };
    this.root.addEventListener('input', onSimpleInput);
    this.root.addEventListener('change', onSimpleInput);
  }

  private siteConfig(): SiteBrandConfig {
    const brandName = (this.getAttribute('brand') || 'INTAX Billing').trim();
    const siteUrl = (this.getAttribute('site-url') || 'https://intax.in').trim();
    const accentColor = (this.getAttribute('accent') || '#dc2626').trim();
    const fromLabel = (this.getAttribute('from') || `${brandName} <hello@intax.in>`).trim();
    return { brandName, siteUrl, accentColor, fromLabel };
  }

  private endpoint(): string {
    return (this.getAttribute('endpoint') || '/api/isuper/mail/campaign').replace(/\/+$/, '');
  }

  private aiEndpoint(): string {
    return (this.getAttribute('ai-endpoint') || '/api/isuper/email/ai-template').trim();
  }

  private testEndpoint(): string {
    return (this.getAttribute('test-endpoint') || '').trim();
  }

  protected override async init() {
    const cfg = this.siteConfig();
    const standards = buildStandardTemplates(cfg);
    const simple = buildSimpleTemplate(cfg);
    this.set({
      standards,
      selectedStdId: standards[0].id,
      simple,
    });
    await this.loadSaved();
  }

  /** Public method for host apps to refresh saved templates. */
  public async reload() {
    await this.loadSaved();
  }

  /** Public method for host apps (e.g. from <the-template-studio>) to open & preview a saved template. */
  public async openTemplate(key: string) {
    if (!key) return;
    this.set({ tab: 'saved', selectedSavedKey: key, error: '', notice: '' });
    if (!this.state.savedList) await this.loadSaved();
    await this.loadSavedDetail(key);
  }

  protected override actions = {
    tab: (el: HTMLElement) => {
      const t = el.dataset['tab'] as TabMode;
      this.set({ tab: t, error: '' });
      if (t === 'saved') {
        if (!this.state.savedList) {
          void this.loadSaved();
        } else if (!this.state.selectedSavedKey && this.state.savedList.length) {
          void this.loadSavedDetail(this.state.savedList[0].tpl_key);
        }
      }
    },
    viewport: (el: HTMLElement) => this.set({ viewport: (el.dataset['viewport'] as ViewportMode) || 'desktop' }),
    toggleSample: () => this.set({ renderSample: !this.state.renderSample }),
    toggleCode: () => this.set({ showCode: !this.state.showCode }),
    selectStd: (el: HTMLElement) => this.set({ selectedStdId: el.dataset['id'] || this.state.selectedStdId, error: '' }),
    saveStd: async () => {
      await this.saveFields(this.currentStd().fields);
    },
    scheduleStd: () => this.saveAndSchedule(this.currentStd().fields, this.currentStd().id === 'std-mca-launch' ? 'MCA' : ''),
    installAll: () => this.installAllStandard(),
    customizeStd: () => {
      const f = this.currentStd().fields;
      this.set({
        simple: {
          ...f,
          key: `${f.key}-custom`,
          name: `${f.name} (Custom)`,
          tag: 'simple',
        },
        tab: 'simple',
        notice: `Loaded "${f.name}" into Simple Template + AI. Edit any value or ask AI to refine it.`,
        error: '',
      });
    },
    swatch: (el: HTMLElement) => {
      const hex = el.dataset['color'];
      if (!hex) return;
      this.state.simple = { ...this.state.simple, accentColor: hex };
      this.render();
    },
    insertVar: (el: HTMLElement) => {
      const token = el.dataset['token'] || '';
      if (!token) return;
      const cur = this.state.simple.message || '';
      this.state.simple = { ...this.state.simple, message: cur ? `${cur} ${token}` : token };
      this.render();
    },
    resetSimple: () => this.set({ simple: buildSimpleTemplate(this.siteConfig()), notice: 'Reset simple template to defaults.', error: '' }),
    aiQuick: (el: HTMLElement) => {
      const prompt = el.dataset['prompt'] || '';
      this.state.aiPrompt = prompt;
      return this.askAi(prompt);
    },
    aiRun: () => this.askAi(this.state.aiPrompt),
    saveSimple: async () => {
      await this.saveFields(this.state.simple);
    },
    scheduleSimple: () => this.saveAndSchedule(this.state.simple),
    reloadSaved: () => this.loadSaved(),
    selectSaved: (el: HTMLElement) => this.loadSavedDetail(el.dataset['key'] || ''),
    scheduleSaved: () => {
      const d = this.state.savedDetail;
      if (!d) return;
      this.emit('the-schedule-template', { key: d.tpl_key, name: d.name, subject: d.subject });
    },
    deleteSaved: () => this.deleteSaved(this.state.selectedSavedKey),
    sendTest: () => this.sendTest(),
  };

  private currentStd(): StandardTemplatePreset {
    return this.state.standards.find((t) => t.id === this.state.selectedStdId) || this.state.standards[0];
  }

  private renderFieldsHtml(fields: EmailTemplateFields, renderSample: boolean): string {
    const cfg = this.siteConfig();
    return renderEmailTemplateHtml(fields, {
      renderSample,
      fallbackBrand: cfg.brandName,
      fallbackUrl: cfg.siteUrl,
    });
  }

  private activePreviewData(): { title: string; subject: string; rawHtml: string; sampleHtml: string } {
    const s = this.state;
    if (s.tab === 'standard') {
      const std = this.currentStd();
      if (!std) return { title: 'Preview', subject: '', rawHtml: '', sampleHtml: '' };
      return {
        title: `Preview: ${std.fields.name}`,
        subject: std.fields.subject,
        rawHtml: this.renderFieldsHtml(std.fields, false),
        sampleHtml: this.renderFieldsHtml(std.fields, true),
      };
    }
    if (s.tab === 'simple') {
      return {
        title: `Live Preview: ${s.simple.name || s.simple.key || 'Simple Template'}`,
        subject: s.simple.subject,
        rawHtml: this.renderFieldsHtml(s.simple, false),
        sampleHtml: this.renderFieldsHtml(s.simple, true),
      };
    }
    const d = s.savedDetail;
    if (!d) return { title: 'Saved Template Preview', subject: '', rawHtml: '', sampleHtml: '' };
    const raw = d.html || '<div style="padding:24px;font-family:system-ui,sans-serif;color:#64748b;">No HTML body stored for this template.</div>';
    return {
      title: `Saved: ${d.name} (${d.tpl_key})`,
      subject: d.subject,
      rawHtml: raw,
      sampleHtml: applySampleMergeVars(raw),
    };
  }

  /** Updates iframe/subject/code in place while typing in Simple Template so focus stays intact. */
  private syncLivePreview() {
    if (this.state.tab !== 'simple') return;
    const data = this.activePreviewData();
    const subjEl = this.root.getElementById('tpl-preview-subject');
    if (subjEl) {
      subjEl.textContent = (this.state.renderSample ? applySampleMergeVars(data.subject) : data.subject) || '(No subject)';
    }
    const titleEl = this.root.getElementById('tpl-preview-title');
    if (titleEl) titleEl.textContent = data.title;
    const frame = this.root.getElementById('tpl-preview-frame') as HTMLIFrameElement | null;
    if (frame) frame.srcdoc = this.state.renderSample ? data.sampleHtml : data.rawHtml;
    const codeEl = this.root.getElementById('tpl-preview-code');
    if (codeEl) codeEl.textContent = data.rawHtml;
  }

  private async loadSaved() {
    try {
      const res = await this.api().get<{ templates?: any[] }>(`${this.endpoint()}/v1/templates`);
      const list: SavedTemplateSummary[] = (Array.isArray(res?.templates) ? res.templates : []).map((t) => {
        const key = String(t.tpl_key || t.key || '');
        return {
          tpl_key: key,
          name: String(t.name || key),
          subject: String(t.subject || ''),
          tag: t.tag ? String(t.tag) : undefined,
        };
      });
      const keepKey =
        this.state.selectedSavedKey && list.some((t) => t.tpl_key === this.state.selectedSavedKey)
          ? this.state.selectedSavedKey
          : list[0]?.tpl_key || '';
      this.set({ savedList: list, selectedSavedKey: keepKey });
      if (this.state.tab === 'saved' && keepKey) {
        await this.loadSavedDetail(keepKey);
      }
    } catch (err) {
      this.set({ savedList: [], error: err instanceof Error ? err.message : String(err) });
    }
  }

  private async loadSavedDetail(key: string) {
    if (!key) return;
    this.set({ selectedSavedKey: key, loadingDetail: true, error: '' });
    try {
      const res = await this.api().get<any>(`${this.endpoint()}/v1/templates/${encodeURIComponent(key)}`);
      const tpl = res?.template || res;
      this.set({
        loadingDetail: false,
        savedDetail: {
          tpl_key: String(tpl?.tpl_key || tpl?.key || key),
          name: String(tpl?.name || key),
          subject: String(tpl?.subject || ''),
          html: String(tpl?.html || ''),
          tag: tpl?.tag ? String(tpl.tag) : undefined,
        },
      });
    } catch (err) {
      this.set({ loadingDetail: false, savedDetail: null, error: err instanceof Error ? err.message : String(err) });
    }
  }

  private async saveFields(fields: EmailTemplateFields): Promise<string | null> {
    const key = normalizeTemplateKey(fields.key || fields.name, 'custom-template');
    this.set({ busy: `save:${key}`, error: '', notice: '' });
    try {
      await this.api().put(`${this.endpoint()}/v1/templates/${encodeURIComponent(key)}`, {
        name: fields.name.trim() || key,
        subject: fields.subject.trim() || `Update from ${this.siteConfig().brandName}`,
        html: this.renderFieldsHtml(fields, false),
        tag: fields.tag || 'custom',
      });
      this.emit('the-template-saved', { key, name: fields.name || key, subject: fields.subject });
      this.set({ busy: '', notice: `Saved "${fields.name || key}" (key: ${key}) to the_campaign.` });
      await this.loadSaved();
      return key;
    } catch (err) {
      this.fail(err);
      return null;
    }
  }

  private async saveAndSchedule(fields: EmailTemplateFields, sourceType?: string) {
    const key = await this.saveFields(fields);
    if (!key) return;
    this.emit('the-schedule-template', {
      key,
      name: fields.name.trim() || key,
      subject: fields.subject.trim(),
      sourceType,
    });
  }

  private async installAllStandard() {
    this.set({ busy: 'installAll', error: '', notice: '' });
    let ok = 0;
    try {
      for (const preset of this.state.standards) {
        const key = normalizeTemplateKey(preset.fields.key);
        await this.api().put(`${this.endpoint()}/v1/templates/${encodeURIComponent(key)}`, {
          name: preset.fields.name,
          subject: preset.fields.subject,
          html: this.renderFieldsHtml(preset.fields, false),
          tag: preset.fields.tag,
        });
        ok++;
      }
      this.emit('the-template-saved', { key: 'all-standard', name: '5 Standard Templates', subject: '' });
      this.set({ busy: '', notice: `Installed all ${ok} standard templates into the_campaign.` });
      await this.loadSaved();
    } catch (err) {
      this.set({
        busy: '',
        error: `Installed ${ok}/${this.state.standards.length} before error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  private async askAi(prompt: string) {
    const clean = (prompt || '').trim();
    if (!clean) {
      this.set({ error: 'Enter an instruction for AI (or pick one of the quick suggestions).' });
      return;
    }
    this.set({ busy: 'ai', error: '', notice: '' });
    try {
      const cur = this.state.simple;
      const res = await this.api().post<{ email?: Partial<EmailTemplateFields> }>(this.aiEndpoint(), {
        prompt: clean,
        current: {
          subject: cur.subject,
          heading: cur.heading,
          message: cur.message,
          highlight: cur.highlight,
          buttonText: cur.buttonText,
          buttonLink: cur.buttonLink,
          signoff: cur.signoff,
        },
      });
      if (!res?.email) throw new Error('AI did not return template fields.');
      this.set({
        busy: '',
        simple: {
          ...cur,
          subject: res.email.subject ?? cur.subject,
          heading: res.email.heading ?? cur.heading,
          message: res.email.message ?? cur.message,
          highlight: res.email.highlight ?? cur.highlight,
          buttonText: res.email.buttonText ?? cur.buttonText,
          buttonLink: res.email.buttonLink ?? cur.buttonLink,
          signoff: res.email.signoff ?? cur.signoff,
        },
        notice: 'AI updated your template fields. Check the live preview and save when ready.',
      });
    } catch (err) {
      this.fail(err);
    }
  }

  private async deleteSaved(key: string) {
    if (!key) return;
    this.set({ busy: `del:${key}`, error: '', notice: '' });
    try {
      await this.api().delete(`${this.endpoint()}/v1/templates/${encodeURIComponent(key)}`);
      this.emit('the-template-deleted', { key });
      this.set({ busy: '', selectedSavedKey: '', savedDetail: null, notice: `Deleted template "${key}".` });
      await this.loadSaved();
    } catch (err) {
      this.fail(err);
    }
  }

  private async sendTest() {
    const testEp = this.testEndpoint();
    if (!testEp) return;
    const data = this.activePreviewData();
    if (!data.rawHtml) return;
    this.set({ busy: 'test', error: '', notice: '' });
    try {
      await this.api().post(testEp, {
        to: this.state.testEmail.trim() || undefined,
        subject: `[Preview] ${applySampleMergeVars(data.subject)}`,
        html: applySampleMergeVars(data.rawHtml),
      });
      this.set({
        busy: '',
        notice: `Sent preview test email to ${this.state.testEmail.trim() || 'your admin email'}.`,
      });
    } catch (err) {
      this.fail(err);
    }
  }

  protected override styles(): string {
    return `
      .tabs { display: inline-flex; gap: 4px; padding: 4px; background: var(--_surface-2); border: 1px solid var(--_border); border-radius: 10px; }
      .tabs button { border: 0; background: transparent; padding: 6px 12px; font-size: 12px; font-weight: 600; color: var(--_muted); border-radius: 7px; }
      .tabs button.on { background: var(--_surface); color: var(--_primary); box-shadow: 0 1px 2px rgba(15,23,42,0.08); }
      .split { display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr); align-items: start; }
      @media (min-width: 900px) { .split { grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); } }
      .std-item { width: 100%; text-align: left; display: block; padding: 11px 12px; border-radius: 10px; border: 1px solid var(--_border); background: var(--_surface); transition: border-color .15s; }
      .std-item:hover { border-color: color-mix(in srgb, var(--_primary) 45%, var(--_border)); }
      .std-item.on { border-color: var(--_primary); background: color-mix(in srgb, var(--_primary) 5%, var(--_surface)); }
      .dot { display: inline-block; width: 9px; height: 9px; border-radius: 999px; margin-right: 6px; vertical-align: middle; }
      .badge-saved { background: color-mix(in srgb, var(--_good) 14%, transparent); color: var(--_good); border: 0; font-weight: 600; }
      .preview-box { border: 1px solid var(--_border); border-radius: 12px; overflow: hidden; background: var(--_surface-2); }
      .preview-bar { background: var(--_surface); border-bottom: 1px solid var(--_border); padding: 10px 12px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
      .preview-meta { background: var(--_surface); border-bottom: 1px solid var(--_border); padding: 9px 12px; font-size: 12px; display: grid; gap: 3px; }
      .preview-meta .k { display: inline-block; width: 52px; color: var(--_muted); }
      .preview-stage { padding: 14px; display: flex; justify-content: center; background: #e2e8f0; }
      .preview-frame-wrap { width: 100%; max-width: 640px; border-radius: 10px; overflow: hidden; border: 1px solid #cbd5e1; background: #ffffff; transition: max-width .2s; }
      .preview-frame-wrap.mobile { max-width: 375px; }
      .preview-frame { width: 100%; height: 500px; border: 0; display: block; background: #f1f5f9; }
      .preview-frame-wrap.mobile .preview-frame { height: 540px; }
      .preview-code { width: 100%; max-height: 500px; overflow: auto; margin: 0; padding: 12px; border-radius: 8px; background: #0f172a; color: #f1f5f9; font: 11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; word-break: break-all; }
      .preview-ft { background: var(--_surface); border-top: 1px solid var(--_border); padding: 10px 12px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
      .seg { display: inline-flex; border: 1px solid var(--_border); border-radius: 8px; padding: 2px; background: var(--_surface-2); }
      .seg button { border: 0; background: transparent; padding: 4px 8px; font-size: 11px; color: var(--_muted); border-radius: 6px; }
      .seg button.on { background: var(--_surface); color: var(--_text); font-weight: 600; }
      .sm-btn { padding: 5px 10px; font-size: 12px; }
      .ai-box { border: 1px solid color-mix(in srgb, var(--_primary) 35%, var(--_border)); background: color-mix(in srgb, var(--_primary) 5%, var(--_surface)); border-radius: 10px; padding: 12px; }
      .chip-btn { padding: 3px 9px; font-size: 11px; border-radius: 999px; border: 1px solid var(--_border); background: var(--_surface); color: var(--_text); }
      .chip-btn:hover { border-color: var(--_primary); }
      .swatches { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; padding-top: 4px; }
      .swatch { width: 22px; height: 22px; padding: 0; border-radius: 999px; border: 2px solid #fff; box-shadow: 0 0 0 1px var(--_border); }
      .swatch.on { box-shadow: 0 0 0 2px var(--_text); transform: scale(1.08); }
      .two { display: grid; gap: 8px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .sticky { position: sticky; top: 12px; }
      .test-in { width: 190px; padding: 5px 8px; font-size: 12px; }
    `;
  }

  protected view(): string {
    const s = this.state;
    const savedCount = s.savedList?.length ?? 0;
    const stdCount = s.standards.length || 7;
    return `
<div class="card stack">
  <div class="row" style="justify-content:space-between">
    <div>
      <h3>Email Templates &amp; Live Look-and-Feel Preview</h3>
      <div class="muted">Preview ${stdCount} standard templates, customize 1 simple template with AI, or inspect saved campaign templates.</div>
    </div>
    <div class="tabs">
      <button data-action="tab" data-tab="standard" class="${s.tab === 'standard' ? 'on' : ''}">${stdCount} Standard Templates</button>
      <button data-action="tab" data-tab="simple" class="${s.tab === 'simple' ? 'on' : ''}">Simple Template + AI</button>
      <button data-action="tab" data-tab="saved" class="${s.tab === 'saved' ? 'on' : ''}">Saved (${savedCount})</button>
    </div>
  </div>
  ${s.notice ? `<div class="notice info">${esc(s.notice)}</div>` : ''}
  ${this.errorView()}
  ${s.tab === 'standard' ? this.standardView() : s.tab === 'simple' ? this.simpleView() : this.savedView()}
</div>`;
  }

  private previewPaneView(actionsHtml: string): string {
    const s = this.state;
    const cfg = this.siteConfig();
    const data = this.activePreviewData();
    const subj = s.renderSample ? applySampleMergeVars(data.subject) : data.subject;
    const frameHtml = s.renderSample ? data.sampleHtml : data.rawHtml;
    const testEp = this.testEndpoint();

    return `
<div class="preview-box">
  <div class="preview-bar">
    <strong id="tpl-preview-title" style="font-size:12px">${esc(data.title)}</strong>
    <div class="row" style="gap:6px">
      <div class="seg">
        <button data-action="viewport" data-viewport="desktop" class="${s.viewport === 'desktop' ? 'on' : ''}">Desktop</button>
        <button data-action="viewport" data-viewport="mobile" class="${s.viewport === 'mobile' ? 'on' : ''}">Mobile</button>
      </div>
      <button class="sm-btn" data-action="toggleSample">${s.renderSample ? 'Sample Data: ON' : 'Raw {{ vars }}'}</button>
      <button class="sm-btn" data-action="toggleCode">${s.showCode ? 'Visual' : 'HTML'}</button>
    </div>
  </div>
  <div class="preview-meta">
    <div><span class="k">From</span><b>${esc(cfg.fromLabel)}</b></div>
    <div><span class="k">To</span>${esc(SAMPLE_LEAD.name)} &lt;${esc(SAMPLE_LEAD.email)}&gt; (${esc(SAMPLE_LEAD.business_name)})</div>
    <div><span class="k">Subject</span><b id="tpl-preview-subject">${esc(subj || '(No subject)')}</b></div>
  </div>
  <div class="preview-stage">
    ${
      s.showCode
        ? `<pre id="tpl-preview-code" class="preview-code">${esc(data.rawHtml)}</pre>`
        : `<div class="preview-frame-wrap ${s.viewport === 'mobile' ? 'mobile' : ''}">
            <iframe id="tpl-preview-frame" class="preview-frame" sandbox="allow-popups allow-popups-to-escape-sandbox" srcdoc="${esc(frameHtml)}"></iframe>
          </div>`
    }
  </div>
  <div class="preview-ft">
    <div class="row">${actionsHtml}</div>
    ${
      testEp
        ? `<div class="row" style="gap:6px">
            <input class="test-in" type="email" data-model="testEmail" value="${esc(s.testEmail)}" placeholder="Test email (blank = yours)">
            <button class="sm-btn" data-action="sendTest" ${s.busy === 'test' ? 'disabled' : ''}>${s.busy === 'test' ? 'Sending…' : 'Test Send'}</button>
          </div>`
        : ''
    }
  </div>
</div>`;
  }

  private standardView(): string {
    const s = this.state;
    const savedKeys = new Set((s.savedList || []).map((t) => t.tpl_key));
    const cur = this.currentStd();
    if (!cur) return '<div class="muted">Loading standard templates…</div>';
    const isCurSaved = savedKeys.has(cur.fields.key);
    const saving = s.busy === `save:${cur.fields.key}`;

    const cards = s.standards
      .map((p) => {
        const on = p.id === cur.id;
        const saved = savedKeys.has(p.fields.key);
        return `
<button class="std-item ${on ? 'on' : ''}" data-action="selectStd" data-id="${esc(p.id)}">
  <div class="row" style="justify-content:space-between">
    <span style="font-size:11px;font-weight:600"><span class="dot" style="background:${esc(p.fields.accentColor)}"></span>${esc(p.badge)}</span>
    ${saved ? '<span class="chip badge-saved">Saved</span>' : ''}
  </div>
  <div style="font-weight:700;margin-top:4px">${esc(p.fields.name)}</div>
  <div class="muted" style="margin-top:2px">For: ${esc(p.audience)}</div>
  <div class="muted" style="margin-top:4px">${esc(p.description)}</div>
</button>`;
      })
      .join('');

    const actionsHtml = `
      <button class="primary sm-btn" data-action="scheduleStd" ${saving ? 'disabled' : ''}>${saving ? 'Syncing…' : 'Sync &amp; Schedule Job'}</button>
      <button class="sm-btn" data-action="saveStd" ${saving ? 'disabled' : ''}>${isCurSaved ? 'Update in Campaign' : 'Save to Campaign'}</button>
      <button class="sm-btn" data-action="customizeStd">Customize in Simple Editor</button>
    `;

    return `
<div class="soft row" style="justify-content:space-between">
  <div class="muted"><b>${s.standards.length} Standard Templates</b> — preview how each looks &amp; feels, then save individually or install all ${s.standards.length} in one click.</div>
  <button class="primary sm-btn" data-action="installAll" ${s.busy === 'installAll' ? 'disabled' : ''}>${s.busy === 'installAll' ? `Installing ${s.standards.length}…` : `Install All ${s.standards.length} Standard Templates`}</button>
</div>
<div class="split">
  <div class="stack">${cards}</div>
  <div class="sticky">${this.previewPaneView(actionsHtml)}</div>
</div>`;
  }

  private simpleView(): string {
    const s = this.state;
    const f = s.simple;
    const key = normalizeTemplateKey(f.key || f.name, 'custom-template');
    const saving = s.busy === `save:${key}`;
    const layouts: { value: TemplateLayout; label: string }[] = [
      { value: 'branded', label: 'Branded Banner' },
      { value: 'card', label: 'Top-Accent Card' },
      { value: 'minimal', label: 'Minimal Letter' },
    ];

    const quickChips = AI_QUICK_PROMPTS.map(
      (q) => `<button class="chip-btn" data-action="aiQuick" data-prompt="${esc(q.prompt)}" ${s.busy === 'ai' ? 'disabled' : ''}>${esc(q.label)}</button>`,
    ).join('');

    const varChips = MERGE_VARIABLES.map(
      (v) => `<button class="chip-btn" data-action="insertVar" data-token="${esc(v.token)}">+ ${esc(v.label)}</button>`,
    ).join('');

    const swatches = ACCENT_SWATCHES.map(
      (sw) => `<button class="swatch ${f.accentColor.toLowerCase() === sw.hex ? 'on' : ''}" data-action="swatch" data-color="${sw.hex}" title="${esc(sw.label)}" style="background:${sw.hex}"></button>`,
    ).join('');

    const actionsHtml = `
      <button class="primary sm-btn" data-action="scheduleSimple" ${saving ? 'disabled' : ''}>${saving ? 'Syncing…' : 'Sync &amp; Schedule Job'}</button>
      <button class="sm-btn" data-action="saveSimple" ${saving ? 'disabled' : ''}>Save Template</button>
      <button class="sm-btn" data-action="resetSimple">Reset Defaults</button>
    `;

    return `
<div class="split">
  <div class="stack">
    <div class="ai-box stack">
      <div class="row" style="justify-content:space-between">
        <h4>AI Assistant for Simple Template</h4>
        <span class="muted">Fills &amp; improves fields below</span>
      </div>
      <textarea data-model="aiPrompt" placeholder="Tell AI what to write or change (e.g. 'Write a short GST billing offer for retail shops')">${esc(s.aiPrompt)}</textarea>
      <div class="row" style="gap:5px">${quickChips}</div>
      <button class="primary sm-btn" data-action="aiRun" ${s.busy === 'ai' ? 'disabled' : ''}>${s.busy === 'ai' ? 'AI is writing…' : 'Ask AI to Fill / Improve Fields'}</button>
    </div>

    <div class="soft stack">
      <h4>Set Your Own Values</h4>
      <div class="two">
        <label>Template Key<input data-simple="key" value="${esc(f.key)}" placeholder="simple-custom"></label>
        <label>Template Name<input data-simple="name" value="${esc(f.name)}" placeholder="My Custom Template"></label>
      </div>
      <div class="two">
        <label>Layout Style<select data-simple="layout">${layouts.map((l) => `<option value="${l.value}"${f.layout === l.value ? ' selected' : ''}>${esc(l.label)}</option>`).join('')}</select></label>
        <div>
          <div class="muted">Accent Color</div>
          <div class="swatches">
            ${swatches}
            <input type="color" data-simple="accentColor" value="${esc(f.accentColor)}" style="width:28px;height:24px;padding:1px">
          </div>
        </div>
      </div>
      <div class="two">
        <label>Brand / Header Name<input data-simple="brandName" value="${esc(f.brandName)}"></label>
        <label>Tagline (optional)<input data-simple="brandTagline" value="${esc(f.brandTagline)}"></label>
      </div>
      <label>Subject Line<input data-simple="subject" value="${esc(f.subject)}"></label>
      <div>
        <div class="muted" style="margin-bottom:4px">Insert variable into message:</div>
        <div class="row" style="gap:5px">${varChips}</div>
      </div>
      <label>Greeting / Heading<input data-simple="heading" value="${esc(f.heading)}"></label>
      <label>Main Message<textarea data-simple="message" rows="4">${esc(f.message)}</textarea></label>
      <label>Key Points / Bullets (optional, one per line)<textarea data-simple="bullets" rows="2">${esc(f.bullets)}</textarea></label>
      <label>Highlight / Offer Box (optional)<textarea data-simple="highlight" rows="2">${esc(f.highlight)}</textarea></label>
      <div class="two">
        <label>Button Text (optional)<input data-simple="buttonText" value="${esc(f.buttonText)}"></label>
        <label>Button Link<input data-simple="buttonLink" value="${esc(f.buttonLink)}" placeholder="https://intax.in"></label>
      </div>
      <label>Sign-off<textarea data-simple="signoff" rows="2">${esc(f.signoff)}</textarea></label>
      <label>Footer Note<input data-simple="footerNote" value="${esc(f.footerNote)}"></label>
    </div>
  </div>
  <div class="sticky">${this.previewPaneView(actionsHtml)}</div>
</div>`;
  }

  private savedView(): string {
    const s = this.state;
    if (s.savedList === null) return '<div class="muted">Loading saved templates…</div>';
    if (!s.savedList.length) {
      return `
<div class="soft stack" style="text-align:center;padding:24px">
  <h4>No templates saved in the_campaign yet</h4>
  <div class="muted">Install the 5 standard templates in one click or save your own from Simple Template + AI.</div>
  <div class="row" style="justify-content:center">
    <button class="primary sm-btn" data-action="installAll" ${s.busy === 'installAll' ? 'disabled' : ''}>${s.busy === 'installAll' ? 'Installing…' : 'Install All 5 Standard Templates'}</button>
    <button class="sm-btn" data-action="tab" data-tab="simple">Open Simple Template + AI</button>
  </div>
</div>`;
    }

    const listHtml = s.savedList
      .map(
        (t) => `
<button class="std-item ${t.tpl_key === s.selectedSavedKey ? 'on' : ''}" data-action="selectSaved" data-key="${esc(t.tpl_key)}">
  <div class="row" style="justify-content:space-between">
    <b>${esc(t.name || t.tpl_key)}</b>
    <span class="chip">${esc(t.tpl_key)}</span>
  </div>
  <div class="muted" style="margin-top:3px">${esc(t.subject || '(No subject)')}</div>
</button>`,
      )
      .join('');

    const delBusy = s.busy === `del:${s.selectedSavedKey}`;
    const actionsHtml = s.selectedSavedKey
      ? `<button class="primary sm-btn" data-action="scheduleSaved">Schedule Job with Template</button>
         <button class="sm-btn bad" data-action="deleteSaved" ${delBusy ? 'disabled' : ''}>${delBusy ? 'Deleting…' : 'Delete Template'}</button>`
      : '';

    return `
<div class="row" style="justify-content:space-between">
  <span class="muted">Templates stored in the_campaign and available in Outreach Schedules.</span>
  <button class="sm-btn" data-action="reloadSaved">Refresh</button>
</div>
<div class="split">
  <div class="stack">${listHtml}</div>
  <div class="sticky">
    ${
      s.loadingDetail
        ? '<div class="soft muted" style="padding:24px;text-align:center">Loading template preview…</div>'
        : s.savedDetail
          ? this.previewPaneView(actionsHtml)
          : '<div class="soft muted" style="padding:24px;text-align:center">Select a saved template on the left to preview how it looks &amp; feels.</div>'
    }
  </div>
</div>`;
  }
}

define('the-mail-templates', TheMailTemplates);
