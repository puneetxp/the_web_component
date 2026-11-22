// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../src/mail/the-mail-accounts";

const presets = [
  { key: "brevo_api", label: "Brevo (API key)", group: "free", kind: "brevo_api", host: null, port: null, security: null, per_hour: null, per_day: 240,
    purpose: "both", free_plan: "300 a day", login_help: "Password = API v3 key", imap_host: null, notes: "" },
  { key: "resend", label: "Resend", group: "free", kind: "smtp", host: "smtp.resend.com", port: 465, security: "ssl", per_hour: null, per_day: 80,
    purpose: "transactional", free_plan: "100 a day", login_help: "Login = resend, password = API key", imap_host: null, notes: "" },
  { key: "hostinger", label: "Hostinger Business Email", group: "mailbox", kind: "smtp", host: "smtp.hostinger.com", port: 465, security: "ssl", per_hour: 50,
    per_day: 300, purpose: "both", free_plan: "~1,000 a day", login_help: "Full mailbox address", imap_host: "imap.hostinger.com", notes: "" },
];
const roles = [
  { key: "outreach", label: "Outreach", address: "hello@{domain}", name: "{first} from {business}", purpose: "marketing", reply_to: null, why: "People can reply.", default_for: "marketing" },
  { key: "system", label: "System", address: "noreply@{domain}", name: "{business}", purpose: "transactional", reply_to: "support@{domain}", why: "Automatic mail only.", default_for: "transactional" },
];
const acct = (o: any = {}) => ({ id: "p1", name: "Hostinger Business Email", kind: "smtp", preset: "hostinger", username: "hello@intaxing.in", from_email: "hello@intaxing.in",
  purpose: "both", per_day: 300, per_hour: 50, status: "active", pause_reason: null, resume_at: null, secret_hint: "…a1b2", ramp_level: null, ramp_start: 20,
  imap_host: "imap.hostinger.com", sent: { last_hour: 0, today: 7 }, ...o });

let calls: { url: string; body: any }[] = [];
let list: any[] = [];
function backend(extra: Record<string, (b: any) => any> = {}) {
  calls = [];
  globalThis.fetch = vi.fn(async (url: any, init: any = {}) => {
    const u = String(url), body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: u, body });
    const route = Object.keys(extra).find((k) => u.endsWith(k) && (init.method ?? "GET") !== "GET");
    let out: any;
    if (route) out = extra[route](body);
    else if (u.endsWith("/providers")) {
      out = { success: true, configured: true, presets, sender_roles: roles, domain: "intaxing.in", business: "INTAX", providers: list,
        total: { accounts: list.length, active: list.filter((a) => a.status === "active").length, per_day: 300, no_limit_set: [], warmup_today: 20, sent_today: 7, total_cap: 300, daily_cap: 250 } };
    } else out = { success: false, message: "no route" };
    return new Response(JSON.stringify(out), { status: out.success === false ? 400 : 200 });
  }) as any;
}
const tick = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };
async function mount(attrs = 'api="https://app.test"') {
  document.body.innerHTML = `<the-mail-accounts ${attrs}></the-mail-accounts>`;
  const el = document.querySelector("the-mail-accounts")!;
  await tick();
  return el;
}
const q = <T extends HTMLElement>(el: Element, sel: string) => el.shadowRoot!.querySelector<T>(sel)!;
const text = (el: Element) => el.shadowRoot!.textContent!.replace(/\s+/g, " ");
function type(el: Element, model: string, value: string, ev = "input") {
  const f = q<HTMLInputElement>(el, `[data-model="${model}"]`);
  f.value = value;
  f.dispatchEvent(new Event(ev, { bubbles: true }));
}

beforeEach(() => { list = [acct(), acct({ id: "p2", name: "Old", preset: "resend", status: "disabled", imap_host: null })]; });

describe("<the-mail-accounts>", () => {
  it("lists accounts with limits, warm-up, bounce tracking and totals; hides removed ones", async () => {
    backend();
    const el = await mount('api="https://app.test" endpoint="/api/x/campaign"');
    expect(calls[0].url).toBe("https://app.test/api/x/campaign/providers");
    const t = text(el);
    expect(t).toContain("Hostinger Business Email");
    expect(t).toContain("bounces: mailbox");
    expect(t).toContain("starts at 20");
    expect(t).toContain("limits add up to 300 a day");
    expect(t).not.toContain("Old");
    expect(t).toContain("Show 1 removed");
  });

  it("adds an account: the service fills limit and sender type; the signer fills the address", async () => {
    backend({ "/providers": (b) => ({ success: true, provider: { id: "p9", name: "Resend" }, received: b }) });
    const el = await mount();
    q<HTMLElement>(el, '[data-action="toggleAdd"]').click();
    await tick(1);
    type(el, "preset", "resend", "change");
    await tick(1);
    // Resend is an app-mail service: the default sender type is the system one.
    expect(q<HTMLSelectElement>(el, '[data-model="role"]').value).toBe("system");
    expect(q<HTMLInputElement>(el, '[data-model="fromEmail"]').value).toBe("noreply@intaxing.in");
    expect(q<HTMLInputElement>(el, '[data-model="perDay"]').value).toBe("80");
    expect(text(el)).toContain("Why noreply@intaxing.in: Automatic mail only.");
    expect(text(el)).toContain("Replies go to support@intaxing.in");
    expect(text(el)).toContain("Login = resend, password = API key");
    // Outreach with a signer: the address follows as you type, without re-drawing.
    type(el, "role", "outreach", "change");
    await tick(1);
    const signer = q<HTMLInputElement>(el, '[data-model="signer"]');
    type(el, "signer", "Puneet");
    expect(q<HTMLInputElement>(el, '[data-model="fromName"]').value).toBe("Puneet from INTAX");
    expect(q(el, '[data-model="signer"]')).toBe(signer); // same element: focus kept
    type(el, "username", "resend");
    type(el, "secret", "re_secret_1234");
    const added: any[] = [];
    el.addEventListener("the-account-added", (e) => added.push((e as CustomEvent).detail));
    q<HTMLElement>(el, '[data-action="add"]').click();
    await tick();
    const post = calls.find((c) => c.body?.preset)!;
    expect(post.body).toEqual({ preset: "resend", username: "resend", secret: "re_secret_1234", from_email: "hello@intaxing.in",
      from_name: "Puneet from INTAX", purpose: "marketing", per_day: "80" });
    expect(added).toEqual([{ id: "p9", name: "Resend" }]);
    expect(text(el)).toContain("Resend added. Press Test");
    expect(el.shadowRoot!.innerHTML).not.toContain("re_secret_1234"); // never shown again
  });

  it("test, pause, resume and remove call the backend and tell the host", async () => {
    list = [acct(), acct({ id: "p3", status: "paused", pause_reason: "Cooling down 24 h", resume_at: "2026-11-24T06:00:00Z" })];
    backend({
      "/providers/test": (b) => ({ success: true, result: b.id === "p1" ? { ok: true, message: "login ok" } : { ok: false, message: "535 auth failed" } }),
      "/providers/update": () => ({ success: true }),
      "/providers/remove": () => ({ success: true, ok: true }),
    });
    const el = await mount();
    expect(text(el)).toContain("Cooling down 24 h");
    expect(text(el)).toContain("resumes");
    q<HTMLElement>(el, '[data-action="test"][data-id="p1"]').click();
    await tick();
    expect(text(el)).toContain("login ok");
    q<HTMLElement>(el, '[data-action="test"][data-id="p3"]').click();
    await tick();
    expect(text(el)).toContain("535 auth failed");
    const changed: any[] = [];
    el.addEventListener("the-account-changed", (e) => changed.push((e as CustomEvent).detail));
    q<HTMLElement>(el, '[data-action="resume"][data-id="p3"]').click();
    await tick();
    q<HTMLElement>(el, '[data-action="pause"][data-id="p1"]').click();
    await tick();
    expect(changed).toEqual([{ id: "p3", status: "active" }, { id: "p1", status: "paused" }]);
    globalThis.confirm = () => true;
    const removed: any[] = [];
    el.addEventListener("the-account-removed", (e) => removed.push((e as CustomEvent).detail));
    q<HTMLElement>(el, '[data-action="remove"][data-id="p1"]').click();
    await tick();
    expect(calls.some((c) => c.url.endsWith("/providers/remove") && c.body.id === "p1")).toBe(true);
    expect(removed).toEqual([{ id: "p1" }]);
  });

  it("says when the_campaign is not connected, and shows backend errors", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ success: true, configured: false, presets: [], providers: [] }))) as any;
    expect(text(await mount())).toContain("Connect the_campaign first");
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ success: false, message: "You Are Not Login" }), { status: 401 })) as any;
    expect(text(await mount())).toContain("You Are Not Login");
  });
});
