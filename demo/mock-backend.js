// Fake backend for the demo pages: answers the component's calls in the browser, so a
// component can be tried with no app behind it. Remove this script to use a real backend.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

const templates = [
  { id: 1, name: "gst-registration-compliance", subject: "Welcome {business_name}: stay GST compliant", enabled: true,
    summary: "Congratulations on your new GST registration. We file GSTR-1 and GSTR-3B on time…" },
  { id: 2, name: "service-gst-return-filing", subject: "GST returns for {business_name}, filed on time", enabled: true,
    summary: "Monthly GST returns handled by a CA team, reminders before due dates…" },
  { id: 3, name: "mca-company-compliance", subject: "Post-incorporation compliance for {business_name}", enabled: true,
    summary: "INC-20A, ADT-1, first board meeting, bank account and GST for your new company…" },
  { id: 4, name: "service-website-development", subject: "A website that brings enquiries", enabled: false,
    summary: "Fast, mobile website with your services and a contact form…" },
];

const real = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url, location.href);
  const body = init.body ? JSON.parse(init.body) : {};
  if (url.pathname.endsWith("/email-template/ai-context")) {
    await wait(300);
    return json({
      success: true,
      sources: {
        gst_new: "Newly registered GST businesses (registered in the last weeks)",
        mca_new: "Newly incorporated companies / LLPs (MCA)",
        existing: "Existing small businesses (registered long ago)",
        any: "Any business owner",
      },
      goals: {
        intro: "Introduce InTaxing and its services",
        service: "Offer one specific service",
        compliance: "Remind about an upcoming compliance step",
        followup: "Follow up after an earlier mail",
      },
      categories: ["IT, Software & Digital", "Manufacturing & Industrial", "Trading, Wholesale & Retail", "General / Unclassified"],
      templates,
      ai: { ready: true, remaining_today: 42, daily_limit: 50, provider: "gemini", model: "gemini-2.5-flash" },
    });
  }
  if (url.pathname.endsWith("/email-template/ai-choose")) {
    await wait(900);
    const fresh = body.source === "gst_new" || body.source === "mca_new";
    const ranking = fresh
      ? [
        { id: body.source === "mca_new" ? 3 : 1, name: body.source === "mca_new" ? templates[2].name : templates[0].name, score: 86,
          reason: "Written for a business that has just registered, and the goal matches." },
        { id: 2, name: templates[1].name, score: 64, reason: "Fits, but talks about one service only." },
      ]
      : [
        { id: 2, name: templates[1].name, score: 61, reason: "Fits an existing business, but reads like an offer." },
        { id: 1, name: templates[0].name, score: 20, reason: "Says 'congratulations on your registration': wrong for old businesses." },
      ];
    return json({
      success: true,
      best_id: ranking[0].score >= 70 ? ranking[0].id : null,
      ranking,
      advice: fresh ? "Use the registration template: it is true for this audience." : "No template fits well: a short new introduction is better.",
      draft_prompt: "Audience: established small businesses. Introduce InTaxing as a CA-led team that keeps GST, income tax and books in order. Friendly, short, no prices.",
      model: "gemini-2.5-flash",
    });
  }
  if (url.pathname.endsWith("/email/ai-template")) {
    await wait(1100);
    return json({
      success: true,
      email: {
        subject: "Keeping {business_name}'s taxes in order",
        heading: "Hello {name},",
        message: "We are InTaxing, a CA-led team that helps small businesses with GST returns, income tax and bookkeeping.\n\nIf filing and reminders take your time, we can take them over and keep everything on schedule.\n\n• GST returns filed on time\n• Income tax for you and the business\n• Simple monthly books",
        highlight: "A 15-minute call is enough to see what you need.",
        buttonText: "Talk to us",
        buttonLink: "https://{host}/contact",
        signoff: "Warm regards,\nTeam InTaxing",
      },
    });
  }
  return real(input, init);
};

// ---- mail accounts (the_campaign providers, through the host app) ----------------------------
const presets = [
  { key: "sendpulse", label: "SendPulse", group: "free", kind: "smtp", host: "smtp-pulse.com", port: 465, security: "ssl", per_hour: 40, per_day: 320, purpose: "both",
    free_plan: "12,000 a month, 50 an hour", login_help: "Login and password from SendPulse > SMTP > Settings", imap_host: null, notes: "Activate SMTP first." },
  { key: "brevo_api", label: "Brevo (API key)", group: "free", kind: "brevo_api", host: null, port: null, security: null, per_hour: null, per_day: 240, purpose: "both",
    free_plan: "300 a day", login_help: "Password = API v3 key (xkeysib-…)", imap_host: null, notes: "Add the server IP under Authorised IPs." },
  { key: "mailjet", label: "Mailjet", group: "free", kind: "smtp", host: "in-v3.mailjet.com", port: 587, security: "starttls", per_hour: null, per_day: 160, purpose: "both",
    free_plan: "6,000 a month, 200 a day", login_help: "Login = API key, password = secret key", imap_host: null, notes: "" },
  { key: "hostinger", label: "Hostinger Business Email", group: "mailbox", kind: "smtp", host: "smtp.hostinger.com", port: 465, security: "ssl", per_hour: 50, per_day: 300, purpose: "both",
    free_plan: "Included with hosting: about 1,000 a day", login_help: "Login = full mailbox address, password = mailbox password", imap_host: "imap.hostinger.com", notes: "Not meant for bulk outreach." },
  { key: "ses", label: "Amazon SES (Mumbai)", group: "paid", kind: "smtp", host: "email-smtp.ap-south-1.amazonaws.com", port: 587, security: "starttls", per_hour: null, per_day: 150, purpose: "both",
    free_plan: "Free only for the first 12 months", login_help: "SMTP credentials from the SES console", imap_host: null, notes: "" },
];
const senderRoles = [
  { key: "outreach", label: "Outreach (default for marketing)", address: "hello@{domain}", name: "{first} from {business}", purpose: "marketing", reply_to: null, default_for: "marketing",
    why: "A real, friendly address that people can answer: fewer spam reports, and replies are interested customers." },
  { key: "personal", label: "Personal (one person signs)", address: "{first}@{domain}", name: "{first} from {business}", purpose: "marketing", reply_to: null, default_for: null,
    why: "Like hello@, but tied to one person: best when that person answers the replies." },
  { key: "system", label: "System mail (default for app mail)", address: "noreply@{domain}", name: "{business}", purpose: "transactional", reply_to: "support@{domain}", default_for: "transactional",
    why: "Only for automatic mail: receipts, password resets. Never for outreach: people can't reply, so they press Spam." },
];
const accounts = [
  { id: "p1", name: "Hostinger Business Email", kind: "smtp", preset: "hostinger", username: "hello@intaxing.in", from_email: "hello@intaxing.in", purpose: "both",
    per_day: 300, per_hour: 50, status: "active", pause_reason: null, resume_at: null, secret_hint: "…a1b2", ramp_level: 22, ramp_start: 20, imap_host: "imap.hostinger.com",
    sent: { last_hour: 3, today: 14 } },
  { id: "p2", name: "Mailjet", kind: "smtp", preset: "mailjet", username: "4f2c…", from_email: "hello@intaxing.in", purpose: "marketing",
    per_day: 160, per_hour: null, status: "paused", pause_reason: "Cooling down 24 h: Mailjet today: 5 hard bounces. Resumes by itself at 20 a day.",
    resume_at: new Date(Date.now() + 20 * 3600e3).toISOString(), secret_hint: "…9f9f", ramp_level: 20, ramp_start: 20, imap_host: null, sent: { last_hour: 0, today: 31 } },
];
const totals = () => {
  const act = accounts.filter((a) => a.status === "active");
  return { accounts: accounts.filter((a) => a.status !== "disabled").length, active: act.length, per_day: act.reduce((n, a) => n + (a.per_day ?? 0), 0),
    no_limit_set: act.filter((a) => a.per_day == null).map((a) => a.name), warmup_today: act.reduce((n, a) => n + Math.min(a.ramp_level ?? a.ramp_start, a.per_day ?? 1e9), 0),
    sent_today: accounts.reduce((n, a) => n + a.sent.today, 0), total_cap: 300, daily_cap: 250 };
};
const before = window.fetch;
window.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url, location.href);
  const body = init.body ? JSON.parse(init.body) : {};
  const p = url.pathname;
  if (!p.includes("/campaign/providers")) return before(input, init);
  await wait(350);
  if (p.endsWith("/providers") && (init.method ?? "GET") === "GET") {
    return json({ success: true, configured: true, presets, sender_roles: senderRoles, domain: "intaxing.in", business: "INTAX", providers: accounts, total: totals() });
  }
  if (p.endsWith("/providers")) {
    const pre = presets.find((x) => x.key === body.preset);
    if (!pre || !body.secret) return json({ success: false, message: "Pick a service and type the password" }, 400);
    const a = { id: "p" + (accounts.length + 1), name: pre.label, kind: pre.kind, preset: pre.key, username: body.username, from_email: body.from_email, purpose: body.purpose,
      per_day: Number(body.per_day) || pre.per_day, per_hour: pre.per_hour, status: "active", pause_reason: null, resume_at: null, secret_hint: "…" + body.secret.slice(-4),
      ramp_level: null, ramp_start: 20, imap_host: pre.imap_host, sent: { last_hour: 0, today: 0 } };
    accounts.push(a);
    return json({ success: true, provider: a, ...(pre.kind === "brevo_api" ? { webhook: { ok: true } } : {}) });
  }
  const a = accounts.find((x) => x.id === body.id);
  if (!a) return json({ success: false, message: "No such account" }, 400);
  if (p.endsWith("/update")) {
    a.status = body.status;
    a.pause_reason = body.status === "paused" ? "Paused by intax" : null;
    a.resume_at = null;
    return json({ success: true, provider: a });
  }
  if (p.endsWith("/test")) {
    return json({ success: true, result: a.id === "p2" ? { ok: false, kind: "provider", message: "SMTP auth: 535 Authentication failed" }
      : { ok: true, message: body.to ? `login ok; test mail sent to ${body.to}` : "SMTP smtp.hostinger.com:465 accepted the login" } });
  }
  if (p.endsWith("/remove")) {
    a.status = "disabled";
    return json({ success: true, ok: true });
  }
  return json({ success: false, message: "unknown" }, 404);
};
