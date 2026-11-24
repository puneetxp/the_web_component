/**
 * Framework-free email template engine, 5 Standard Templates, and 1 Simple
 * Customizable Template for <the-mail-templates> (reusable on any site).
 */

export type TemplateLayout = 'branded' | 'minimal' | 'card';

export interface SiteBrandConfig {
  brandName: string;
  siteUrl: string;
  accentColor: string;
  fromLabel: string;
}

export interface EmailTemplateFields {
  key: string;
  name: string;
  tag: string;
  layout: TemplateLayout;
  accentColor: string;
  brandName: string;
  brandTagline: string;
  subject: string;
  preheader: string;
  heading: string;
  message: string;
  bullets: string;
  highlight: string;
  buttonText: string;
  buttonLink: string;
  signoff: string;
  footerNote: string;
}

export interface StandardTemplatePreset {
  id: string;
  badge: string;
  audience: string;
  description: string;
  fields: EmailTemplateFields;
}

export const ACCENT_SWATCHES = [
  { label: 'Brand Red', hex: '#dc2626' },
  { label: 'Executive Indigo', hex: '#4f46e5' },
  { label: 'Emerald Green', hex: '#059669' },
  { label: 'Compliance Amber', hex: '#d97706' },
  { label: 'Modern Slate', hex: '#0f172a' },
] as const;

export const MERGE_VARIABLES = [
  { label: 'Greeting', token: '{{ greeting }}' },
  { label: 'Business Name', token: '{{ lead.business_name | default: "your business" }}' },
  { label: 'Contact Name', token: '{{ lead.name | default: "there" }}' },
  { label: 'City', token: '{{ lead.city | default: "your city" }}' },
  { label: 'Category', token: '{{ lead.category | default: "your industry" }}' },
] as const;

export const SAMPLE_LEAD = {
  greeting: 'Hello Rahul',
  name: 'Rahul Sharma',
  business_name: 'Sharma Enterprises',
  company_name: 'Sharma Enterprises',
  city: 'Jaipur',
  state: 'Rajasthan',
  category: 'Wholesale & Trading',
  email: 'rahul@sharmaenterprises.in',
};

function escHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeColor(hex: string): string {
  return /^#[0-9a-fA-F]{3,8}$/.test((hex || '').trim()) ? hex.trim() : '#dc2626';
}

function safeHref(url: string, fallback = 'https://intax.in'): string {
  const u = (url || '').trim();
  if (/^https?:\/\//i.test(u) || /^mailto:/i.test(u) || /^tel:/i.test(u)) return u;
  return fallback;
}

export function normalizeTemplateKey(input: string, fallback = 'custom-template'): string {
  return (
    String(input || fallback)
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/(^-|-$)/g, '') || fallback
  );
}

/**
 * Replaces common Liquid / Handlebars-style campaign merge tags with sample lead
 * values so previews show how the email actually reads in a recipient's inbox.
 */
export function applySampleMergeVars(text: string): string {
  if (!text) return '';
  return text
    .replace(/\{\{\s*greeting\s*(?:\|[^}]*)?\}\}/gi, SAMPLE_LEAD.greeting)
    .replace(/\{\{\s*lead\.business_name\s*(?:\|[^}]*)?\}\}/gi, SAMPLE_LEAD.business_name)
    .replace(/\{\{\s*lead\.company_name\s*(?:\|[^}]*)?\}\}/gi, SAMPLE_LEAD.company_name)
    .replace(/\{\{\s*lead\.name\s*(?:\|[^}]*)?\}\}/gi, SAMPLE_LEAD.name)
    .replace(/\{\{\s*lead\.city\s*(?:\|[^}]*)?\}\}/gi, SAMPLE_LEAD.city)
    .replace(/\{\{\s*lead\.state\s*(?:\|[^}]*)?\}\}/gi, SAMPLE_LEAD.state)
    .replace(/\{\{\s*lead\.category\s*(?:\|[^}]*)?\}\}/gi, SAMPLE_LEAD.category)
    .replace(/\{\{\s*lead\.email\s*(?:\|[^}]*)?\}\}/gi, SAMPLE_LEAD.email)
    .replace(/\{\{\s*unsubscribe_url\s*(?:\|[^}]*)?\}\}/gi, '#unsubscribe-preview');
}

/**
 * Renders structured template fields into a clean, responsive, email-client-safe
 * HTML email with inline CSS.
 */
export function renderEmailTemplateHtml(
  fields: Partial<EmailTemplateFields>,
  opts?: { renderSample?: boolean; fallbackBrand?: string; fallbackUrl?: string },
): string {
  const f = (v?: string) => {
    const raw = String(v ?? '');
    return opts?.renderSample ? applySampleMergeVars(raw) : raw;
  };

  const fallbackBrand = opts?.fallbackBrand || 'INTAX Billing';
  const fallbackUrl = opts?.fallbackUrl || 'https://intax.in';
  const accent = safeColor(fields.accentColor || '#dc2626');
  const layout: TemplateLayout = fields.layout || 'branded';
  const brandName = f(fields.brandName || fallbackBrand).trim();
  const brandTagline = f(fields.brandTagline || '').trim();
  const preheader = f(fields.preheader || '').trim();
  const heading = f(fields.heading || '').trim();
  const message = f(fields.message || '').trim();
  const highlight = f(fields.highlight || '').trim();
  const buttonText = f(fields.buttonText || '').trim();
  const buttonLink = safeHref(f(fields.buttonLink || fallbackUrl), fallbackUrl);
  const signoff = f(fields.signoff || '').trim();
  const footerNote = f(
    fields.footerNote || `Sent via ${fallbackBrand} • GST Invoicing, Inventory & Business Catalog`,
  ).trim();

  const bulletItems = f(fields.bullets || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);

  const paragraphsHtml = message
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;color:#334155;font-size:15px;line-height:1.65;white-space:pre-line;">${escHtml(p)}</p>`,
    )
    .join('');

  const bulletsHtml = bulletItems.length
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:14px 0 18px;border-collapse:collapse;">
        ${bulletItems
          .map(
            (item) => `<tr>
              <td valign="top" style="width:22px;padding:4px 8px 4px 0;color:${accent};font-size:15px;font-weight:700;">&#10003;</td>
              <td style="padding:4px 0;color:#1e293b;font-size:14px;line-height:1.55;">${escHtml(item)}</td>
            </tr>`,
          )
          .join('')}
      </table>`
    : '';

  const highlightHtml = highlight
    ? `<div style="margin:18px 0;padding:14px 16px;background:#f8fafc;border-left:4px solid ${accent};border-radius:6px;color:#1e293b;font-size:14px;line-height:1.55;white-space:pre-line;">${escHtml(highlight)}</div>`
    : '';

  const buttonHtml =
    buttonText && fields.buttonLink?.trim()
      ? `<div style="margin:22px 0 20px;">
          <a href="${escHtml(buttonLink)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:${accent};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:8px;">${escHtml(buttonText)}</a>
        </div>`
      : '';

  const signoffHtml = signoff
    ? `<p style="margin:20px 0 0;color:#475569;font-size:14px;line-height:1.6;white-space:pre-line;">${escHtml(signoff)}</p>`
    : '';

  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escHtml(preheader)}</div>`
    : '';

  const unsubHref = opts?.renderSample ? '#unsubscribe-preview' : '{{ unsubscribe_url }}';
  const topUnsubHtml = `<div style="max-width:600px;margin:0 auto 8px;text-align:right;font-size:11px;color:#64748b;">
    <a href="${unsubHref}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>
  </div>`;
  const footerUnsubHtml = `<div style="margin-top:8px;font-size:11px;color:#64748b;">
    Don't want these emails? <a href="${unsubHref}" style="color:#64748b;text-decoration:underline;">Unsubscribe in one click</a>.
  </div>`;

  if (layout === 'minimal') {
    return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:18px 12px 24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  ${preheaderHtml}
  ${topUnsubHtml}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;">
    <tr>
      <td style="padding:28px 30px;">
        <div style="margin:0 0 18px;padding-bottom:12px;border-bottom:2px solid ${accent};">
          <span style="font-size:15px;font-weight:700;color:#0f172a;letter-spacing:-0.01em;">${escHtml(brandName)}</span>
          ${brandTagline ? `<span style="font-size:12px;color:#64748b;margin-left:8px;">${escHtml(brandTagline)}</span>` : ''}
        </div>
        ${heading ? `<h2 style="margin:0 0 14px;color:#0f172a;font-size:18px;font-weight:700;line-height:1.35;">${escHtml(heading)}</h2>` : ''}
        ${paragraphsHtml}
        ${bulletsHtml}
        ${highlightHtml}
        ${buttonHtml}
        ${signoffHtml}
      </td>
    </tr>
    <tr>
      <td style="padding:14px 30px;background:#f8fafc;border-top:1px solid #e2e8f0;border-radius:0 0 10px 10px;font-size:12px;color:#64748b;line-height:1.5;">
        <div>${escHtml(footerNote)}</div>
        ${footerUnsubHtml}
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  if (layout === 'card') {
    return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:18px 12px 24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  ${preheaderHtml}
  ${topUnsubHtml}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
    <tr>
      <td style="height:6px;background:${accent};font-size:0;line-height:0;">&nbsp;</td>
    </tr>
    <tr>
      <td style="padding:24px 28px 10px;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${accent};">${escHtml(brandName)}</div>
        ${brandTagline ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">${escHtml(brandTagline)}</div>` : ''}
      </td>
    </tr>
    <tr>
      <td style="padding:8px 28px 28px;">
        ${heading ? `<h1 style="margin:0 0 14px;color:#0f172a;font-size:21px;font-weight:700;line-height:1.3;">${escHtml(heading)}</h1>` : ''}
        ${paragraphsHtml}
        ${bulletsHtml}
        ${highlightHtml}
        ${buttonHtml}
        ${signoffHtml}
      </td>
    </tr>
    <tr>
      <td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;text-align:center;line-height:1.5;">
        <div>${escHtml(footerNote)}</div>
        ${footerUnsubHtml}
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:18px 12px 24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  ${preheaderHtml}
  ${topUnsubHtml}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
    <tr>
      <td style="background:${accent};padding:22px 28px;color:#ffffff;">
        <div style="font-size:18px;font-weight:700;letter-spacing:-0.01em;">${escHtml(brandName)}</div>
        ${brandTagline ? `<div style="font-size:12px;opacity:0.9;margin-top:4px;">${escHtml(brandTagline)}</div>` : ''}
      </td>
    </tr>
    <tr>
      <td style="padding:26px 28px;">
        ${heading ? `<h2 style="margin:0 0 14px;color:#0f172a;font-size:20px;font-weight:700;line-height:1.35;">${escHtml(heading)}</h2>` : ''}
        ${paragraphsHtml}
        ${bulletsHtml}
        ${highlightHtml}
        ${buttonHtml}
        ${signoffHtml}
      </td>
    </tr>
    <tr>
      <td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;line-height:1.5;">
        <div>${escHtml(footerNote)}</div>
        ${footerUnsubHtml}
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Builds the 5 Standard Templates customized for any host site's brand & URL. */
export function buildStandardTemplates(site: SiteBrandConfig): StandardTemplatePreset[] {
  const b = site.brandName || 'INTAX Billing';
  const u = site.siteUrl || 'https://intax.in';
  const primary = safeColor(site.accentColor || '#dc2626');

  return [
    {
      id: 'std-gst-welcome',
      badge: 'Standard 1 • GST Billing',
      audience: 'Growing Businesses & Shops',
      description: 'Warm first-contact introduction to simple GST billing, stock tracking, and instant customer invoice emails.',
      fields: {
        key: 'std-gst-welcome',
        name: 'GST Billing & Stock Starter',
        tag: 'standard',
        layout: 'branded',
        accentColor: primary,
        brandName: b,
        brandTagline: 'GST Invoicing, Stock Ledger & Business Accounting',
        subject: 'Simple GST billing & stock tracking for {{ lead.business_name | default: "your business" }}',
        preheader: 'Create GST-ready invoices and track stock in minutes.',
        heading: '{{ greeting }},',
        message:
          'Managing day-to-day GST invoices, stock levels, and customer balances for {{ lead.business_name | default: "your business" }} does not have to take hours every week.\n\n' +
          `${b} brings GST-ready invoicing, inventory stock ledgers, and customer accounts into one simple workspace designed for Indian businesses.`,
        bullets: [
          'Create GST-compliant invoices with HSN/SAC & automatic tax totals',
          'Auto-update stock quantities on every sale and purchase entry',
          'Email clean receipts directly to your customers',
        ].join('\n'),
        highlight: 'Quick start: Set up your business book and create your first GST invoice in under 3 minutes — no accounting jargon required.',
        buttonText: `Start Free on ${b}`,
        buttonLink: u,
        signoff: `Warm regards,\nTeam ${b}`,
        footerNote: `${b} • Simple GST billing & inventory for Indian businesses. Reply directly if you have any questions.`,
      },
    },
    {
      id: 'std-mca-launch',
      badge: 'Standard 2 • MCA / LLP',
      audience: 'Newly Incorporated Companies & LLPs (Public MCA Data)',
      description: 'Executive launch-kit email for newly incorporated Private Limited companies and LLPs needing structured day-one books.',
      fields: {
        key: 'std-mca-launch',
        name: 'New Company / LLP Launch Kit',
        tag: 'standard',
        layout: 'branded',
        accentColor: '#4f46e5',
        brandName: `${b} for Companies`,
        brandTagline: 'Day-One Billing, Ledgers & Client Management',
        subject: 'Day-one billing & accounting setup for {{ lead.business_name | default: "your company" }}',
        preheader: 'Keep invoices, client ledgers, and expense records audit-ready from day one.',
        heading: '{{ greeting }},',
        message:
          'Best wishes on incorporating {{ lead.business_name | default: "your new company" }}!\n\n' +
          `Early-stage companies move fast, and scattered spreadsheets quickly turn into compliance headaches. ${b} gives your team a clean, structured workspace for invoicing, receivables, purchase bills, and double-entry books.`,
        bullets: [
          'Professional branded invoices & recurring client billing',
          'Launch a clean company portfolio or e-commerce website alongside your books',
          'Clear party ledgers and purchase/stock records ready for your CA',
        ].join('\n'),
        highlight: 'Built for Indian founders & finance teams — works smoothly on desktop and mobile with zero installation.',
        buttonText: 'Explore Company Workspace',
        buttonLink: u,
        signoff: `Best regards,\n${b} Onboarding Team`,
        footerNote: `${b} • Structured billing and accounting for growing Indian companies & LLPs.`,
      },
    },
    {
      id: 'std-gst-compliance',
      badge: 'Standard 3 • Compliance',
      audience: 'Existing Businesses & Traders',
      description: 'Helpful monthly GST filing & invoice reconciliation reminder with a clear checklist and amber compliance styling.',
      fields: {
        key: 'std-gst-compliance',
        name: 'GST Return & Reconciliation Reminder',
        tag: 'standard',
        layout: 'card',
        accentColor: '#d97706',
        brandName: `${b} Compliance Desk`,
        brandTagline: 'Stress-Free Monthly GST Readiness',
        subject: 'Keep {{ lead.business_name | default: "your business" }} GST invoices reconciled this month',
        preheader: 'Avoid last-minute GST filing rush with organized sales and purchase registers.',
        heading: '{{ greeting }},',
        message:
          'Monthly GST filing is much smoother when every sales invoice, credit note, and supplier bill for {{ lead.business_name | default: "your business" }} is already organized in one place.\n\n' +
          `Instead of chasing missing bills at the end of the month, ${b} keeps your invoice register, GST summaries, and party balances updated automatically as you bill.`,
        bullets: [
          'Clean invoice numbering with automatic GST tax breakdown',
          'Instant sales & purchase summaries ready to share with your CA',
          'Track pending customer payments and send polite reminders',
        ].join('\n'),
        highlight: 'Tip: Reconciling invoices weekly takes 5 minutes and prevents input tax credit (ITC) mismatches.',
        buttonText: 'Organize Your GST Bills',
        buttonLink: u,
        signoff: `Regards,\nTeam ${b}`,
        footerNote: `${b} • Keeping Indian businesses GST-ready without spreadsheet chaos.`,
      },
    },
    {
      id: 'std-product-catalog',
      badge: 'Standard 4 • E-Commerce & Portfolio',
      audience: 'Retailers, Wholesalers & Service Providers',
      description: 'Showcase email highlighting e-commerce websites, business portfolio sites, stock ledgers, and synced billing.',
      fields: {
        key: 'std-product-catalog',
        name: 'E-Commerce, Portfolio Website & Inventory',
        tag: 'standard',
        layout: 'card',
        accentColor: '#059669',
        brandName: `${b} Web & Catalog`,
        brandTagline: 'E-Commerce Website, Business Portfolio & Billing Together',
        subject: 'Launch an e-commerce or portfolio website for {{ lead.business_name | default: "your business" }}',
        preheader: 'Get a ready e-commerce storefront or business portfolio site synced with your catalog and GST billing.',
        heading: '{{ greeting }},',
        message:
          'Running {{ lead.business_name | default: "your business" }} in {{ lead.category | default: "your industry" }} is much easier when your website, product catalog, and billing work together.\n\n' +
          `With ${b}, we provide a clean e-commerce website to showcase and sell your products, or a professional portfolio website for your services — directly connected to your inventory and GST billing.`,
        bullets: [
          'Ready-to-launch e-commerce website for products with live stock sync',
          'Clean business portfolio website to showcase services and capture direct leads',
          'Bulk import products via CSV and manage GST invoices & stock in one place',
        ].join('\n'),
        highlight: 'One workspace powers your e-commerce or portfolio website, counter billing, and real-time stock ledger.',
        buttonText: 'Launch Your Business Website',
        buttonLink: u,
        signoff: `Cheers,\nTeam ${b}`,
        footerNote: `${b} • E-commerce websites, business portfolio sites, GST billing & inventory for Indian businesses.`,
      },
    },
    {
      id: 'std-followup-checkin',
      badge: 'Standard 5 • Follow-Up',
      audience: 'Warm Leads & Prior Enquiries',
      description: 'Short, personal letter-style follow-up designed for high reply rates after an initial outreach or enquiry.',
      fields: {
        key: 'std-followup-checkin',
        name: 'Friendly Follow-Up & Quick Demo',
        tag: 'standard',
        layout: 'minimal',
        accentColor: '#0f172a',
        brandName: `${b} Support`,
        brandTagline: 'Quick Check-In',
        subject: 'Quick check-in for {{ lead.business_name | default: "your business" }}',
        preheader: 'Happy to walk you through a 5-minute setup whenever convenient.',
        heading: '{{ greeting }},',
        message:
          'Just following up on my earlier note to see how you are currently handling GST billing and stock tracking at {{ lead.business_name | default: "your business" }}.\n\n' +
          'If you would like, we can set up a sample book with a few of your products or services in 5 minutes so you can see how it feels before deciding anything.',
        bullets: '',
        highlight: 'Simply reply to this email with a convenient time (or your phone number), and our team will help you get started.',
        buttonText: 'View Live Workspace',
        buttonLink: u,
        signoff: `Warm regards,\nTeam ${b}`,
        footerNote: `${b} • Just hit reply if you would like a quick walkthrough or have any questions.`,
      },
    },
    {
      id: 'std-all-services',
      badge: 'Standard 6 • All-in-One',
      audience: 'Any Business, Shop, or Service Provider',
      description: 'All-in-one template covering GST billing, stock & accounts, e-commerce websites, portfolio sites, and online services together.',
      fields: {
        key: 'std-all-services',
        name: 'All-in-One: Website, Services & Billing',
        tag: 'standard',
        layout: 'branded',
        accentColor: primary,
        brandName: b,
        brandTagline: 'Websites • Business Services • GST Billing & Inventory',
        subject: 'Website, services & GST billing in one place for {{ lead.business_name | default: "your business" }}',
        preheader: 'E-commerce store, business portfolio website, service listings, and GST billing — all connected.',
        heading: '{{ greeting }},',
        message:
          'Running {{ lead.business_name | default: "your business" }} usually means juggling separate tools for your website, service enquiries, stock, and billing.\n\n' +
          `${b} gives you everything in one simple platform — GST billing, inventory & accounts, plus a ready e-commerce or portfolio website to showcase your products and services online.`,
        bullets: [
          'E-Commerce Website: Sell your products online with automatic stock & billing sync',
          'Portfolio & Services Site: Showcase your business services and capture direct customer leads',
          'GST Billing & Accounts: GST-ready invoices, party ledgers, and instant customer email receipts',
          'Inventory & Compliance Ready: Real-time stock ledger and clean summaries ready for your CA',
        ].join('\n'),
        highlight: 'One platform for your website, online services, and daily GST billing — get started in minutes.',
        buttonText: `Explore All ${b} Services`,
        buttonLink: u,
        signoff: `Warm regards,\nTeam ${b}`,
        footerNote: `${b} • E-commerce & portfolio websites, business services, GST billing & inventory for Indian businesses.`,
      },
    },
    {
      id: 'std-billing-intro',
      badge: 'Standard 7 • Best Billing Intro',
      audience: 'First-Contact Outreach (High Open & Reply Rate)',
      description: 'Short, personal letter-style introduction focused on billing — built for primary inbox placement and easy replies.',
      fields: {
        key: 'std-billing-intro',
        name: 'Best Billing Introduction (High-Reply)',
        tag: 'standard',
        layout: 'minimal',
        accentColor: primary,
        brandName: b,
        brandTagline: 'Simple GST Billing & Business Workspace',
        subject: 'Quick intro: simpler billing for {{ lead.business_name | default: "your business" }}',
        preheader: 'Create GST invoices, track stock, and manage party balances from one clean workspace.',
        heading: '{{ greeting }},',
        message:
          `I am reaching out from ${b}. We build a simple, fast billing and accounting workspace for Indian businesses like {{ lead.business_name | default: "yours" }}.\n\n` +
          'Many business owners tell us they spend too much time switching between spreadsheets, billing software, and WhatsApp just to track invoices and payments. We keep everything in one clean place:',
        bullets: [
          'Create & email GST-ready invoices in under a minute',
          'Track stock quantities and customer/supplier balances automatically',
          'Add an online e-commerce or business portfolio website whenever you are ready',
        ].join('\n'),
        highlight: 'Would you like to try a 2-minute interactive walkthrough with your own business name? Click below or reply to this email and we will set it up for you.',
        buttonText: `Try Live ${b} Demo`,
        buttonLink: `${u.replace(/\/+$/, '')}/demo`,
        signoff: `Warm regards,\nTeam ${b}`,
        footerNote: `${b} • Simple GST billing, inventory & business websites. Reply anytime if you would like a quick walkthrough.`,
      },
    },
  ];
}

/** Builds the 1 Simple Customizable Template that anyone can edit directly and enhance with AI. */
export function buildSimpleTemplate(site: SiteBrandConfig): EmailTemplateFields {
  const b = site.brandName || 'INTAX Billing';
  const u = site.siteUrl || 'https://intax.in';
  const primary = safeColor(site.accentColor || '#dc2626');

  return {
    key: 'simple-custom',
    name: 'Simple Custom Template',
    tag: 'simple',
    layout: 'branded',
    accentColor: primary,
    brandName: b,
    brandTagline: 'Simple Business Email',
    subject: 'A quick update for {{ lead.business_name | default: "your business" }}',
    preheader: 'Simple, clear message you can customize or polish with AI.',
    heading: '{{ greeting }},',
    message:
      'We wanted to share a quick update with {{ lead.business_name | default: "your team" }}.\n\n' +
      'Replace this text with your own announcement, service offer, or message — or use the AI assistant above to write and refine it for you.',
    bullets: ['Key benefit or point #1', 'Key benefit or point #2'].join('\n'),
    highlight: 'Add an optional highlight, offer, or important note here.',
    buttonText: 'Learn More',
    buttonLink: u,
    signoff: `Warm regards,\nTeam ${b}`,
    footerNote: `Sent by ${b} • Reply to this email anytime.`,
  };
}
