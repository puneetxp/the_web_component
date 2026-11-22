// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import "../src/mail/the-mail-health";
import "../src/mail/the-mail-schedules";
import "../src/mail/the-mail-log";

type Route = (url: URL, method: string, body: any) => any;
let calls: { url: string; method: string; body: any }[] = [];
function backend(route: Route) {
  calls = [];
  globalThis.fetch = vi.fn(async (u: any, init: any = {}) => {
    const url = new URL(String(u));
    const body = init.body ? JSON.parse(init.body) : undefined;
    const method = init.method ?? "GET";
    calls.push({ url: url.pathname + url.search, method, body });
    const out = route(url, method, body) ?? { success: false, message: "no route" };
    return new Response(JSON.stringify(out), { status: out.success === false ? 400 : 200 });
  }) as any;
}
const tick = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };
async function mount(tag: string, attrs = "") {
  document.body.innerHTML = `<${tag} api="https://app.test" ${attrs}></${tag}>`;
  const el = document.querySelector(tag)!;
  await tick();
  return el;
}
const text = (el: Element) => el.shadowRoot!.textContent!.replace(/\s+/g, " ");
const q = <T extends HTMLElement>(el: Element, s: string) => el.shadowRoot!.querySelector<T>(s)!;
function set(el: Element, model: string, value: string, ev = "input") {
  const f = q<HTMLInputElement>(el, `[data-model="${model}"]`);
  f.value = value;
  f.dispatchEvent(new Event(ev, { bubbles: true }));
}

const health = (o: any = {}) => ({
  ok: false, business: { name: "INTAX", status: "active", pause_reason: null, total_cap: 300 },
  today: { sent: 45, cap: 250, remaining: 205 }, last_7_days: { sent: 800, hard_bounce: 20, spam: 0, spam_rate: 0, hard_bounce_rate: 0.025 },
  accounts: [
    { id: "p1", name: "Hostinger", status: "active", pause_reason: null, resume_at: null, ramp_level: 22, per_day: 300, sent_today: 14 },
    { id: "p2", name: "Mailjet", status: "paused", pause_reason: "Cooling down 24 h", resume_at: "2026-11-24T06:00:00Z", ramp_level: 20, per_day: 160, sent_today: 31 },
  ],
  paused: 1, cooling_down: 1,
  alerts: Array.from({ length: 7 }, (_, i) => ({ text: `alert ${i}`, at: "2026-11-23T06:00:00Z" })), ...o,
});

describe("<the-mail-health>", () => {
  it("summarises paused / cooling-down accounts, today, the 7-day rates against safe limits, alerts", async () => {
    backend((u) => u.pathname.endsWith("/campaign/v1/health") ? health() : null);
    const seen: any[] = [];
    document.addEventListener("the-health", (e) => seen.push((e as CustomEvent).detail));
    const el = await mount("the-mail-health", 'endpoint="/api/isuper/email-template/campaign"');
    expect(calls[0].url).toBe("/api/isuper/email-template/campaign/v1/health");
    const t = text(el);
    expect(t).toContain("1 account paused, 1 cooling down (come back by themselves)");
    expect(t).toContain("today 45 of 250");
    expect(t).toContain("bounces 2.5%");
    expect(q(el, ".warn")).toBeTruthy(); // 2.5% is over the 2% safe line
    expect(t).toContain("Cooling down 24 h");
    expect(t).toContain("alert 4");
    expect(t).not.toContain("alert 5"); // 5 shown, the rest behind "All 7"
    q<HTMLElement>(el, '[data-action="toggleAlerts"]').click();
    expect(text(el)).toContain("alert 6");
    expect(seen.at(-1)).toEqual({ ok: false, paused: 1, cooling_down: 1 });
  });

  it("compact shows one line; account problems that need a person are red", async () => {
    backend(() => health({ cooling_down: 0, accounts: [{ ...health().accounts[1], resume_at: null }] }));
    const el = await mount("the-mail-health", "compact");
    expect(text(el)).toContain("1 account paused, 1 need you");
    expect(q(el, ".dot.bad")).toBeTruthy();
    expect(el.shadowRoot!.querySelector("h4")).toBeNull();
    backend(() => health({ ok: true, paused: 0, cooling_down: 0, accounts: [health().accounts[0]], alerts: [] }));
    expect(text(await mount("the-mail-health", "compact"))).toContain("All 1 account sending");
  });
});

describe("<the-mail-schedules>", () => {
  const sched = { id: "sch00000001", template_key: "services", status: "active", start_date: "2026-11-23", reserve: 40, filter: { min_score: 50 },
    window: { days: [1, 2, 3, 4, 5, 6], from: "09:00", to: "19:00", timezone: "Asia/Kolkata" },
    today: { date: "2026-11-23", planned: 60, queued: 38, sent: 21, failed: 1, next_send: "2026-11-23T08:00:00Z" } };

  it("lists schedules with today's numbers; creates one; pause cancels queued mail", async () => {
    const list = [sched];
    backend((u, m, b) => {
      if (u.pathname.endsWith("/v1/templates")) return { templates: [{ tpl_key: "services", name: "Services", subject: "S" }, { tpl_key: "welcome", name: "Welcome", subject: "W" }] };
      if (u.pathname.endsWith("/v1/schedules") && m === "GET") return { schedules: list };
      if (u.pathname.endsWith("/v1/schedules") && m === "POST") {
        const s = { ...sched, id: "sch00000002", template_key: b.template, filter: b.filter, window: { ...b.window, timezone: "Asia/Kolkata" } };
        list.push(s);
        return { schedule: s };
      }
      if (m === "PATCH") return { schedule: { ...sched, status: b.status }, cancelled: 38 };
      return null;
    });
    const el = await mount("the-mail-schedules");
    let t = text(el);
    expect(t).toContain("services");
    expect(t).toContain("min score: 50");
    expect(t).toContain("60 planned");
    expect(t).toContain("1 failed");
    q<HTMLElement>(el, '[data-action="toggleAdd"]').click();
    set(el, "template", "welcome", "change");
    set(el, "region", "Delhi");
    set(el, "minScore", "60");
    q<HTMLElement>(el, '[data-action="day"][data-day="6"]').click(); // drop Saturday
    const created: any[] = [];
    el.addEventListener("the-schedule-created", (e) => created.push((e as CustomEvent).detail));
    q<HTMLElement>(el, '[data-action="create"]').click();
    await tick();
    const post = calls.find((c) => c.method === "POST")!;
    expect(post.body).toMatchObject({ template: "welcome", filter: { state: "Delhi", min_score: 60 }, window: { days: [1, 2, 3, 4, 5], from: "09:00", to: "19:00" }, reserve: 40 });
    expect(created).toEqual([{ id: "sch00000002", template: "welcome" }]);
    const changed: any[] = [];
    el.addEventListener("the-schedule-changed", (e) => changed.push((e as CustomEvent).detail));
    q<HTMLElement>(el, '[data-action="pause"][data-id="sch00000001"]').click();
    await tick();
    expect(calls.find((c) => c.method === "PATCH")!.url).toBe("/api/isuper/email-template/campaign/v1/schedules/sch00000001");
    expect(changed[0]).toEqual({ id: "sch00000001", status: "paused", cancelled: 38 });
    t = text(el);
    expect(t).toContain("38 queued mails cancelled");
  });

  it("can't create without templates", async () => {
    backend((u) => (u.pathname.endsWith("/v1/templates") ? { templates: [] } : { schedules: [] }));
    const el = await mount("the-mail-schedules");
    expect(text(el)).toContain("No templates in the_campaign yet");
    expect(q<HTMLButtonElement>(el, '[data-action="toggleAdd"]').disabled).toBe(true);
  });
});

describe("<the-mail-log>", () => {
  const sends = [{ id: "s1", email: "old@shop.in", template_key: "services", status: "bounced", error: null, provider_id: "p2", purpose: "marketing",
    schedule_id: "x", due_at: null, created_at: "2026-11-23T05:00:00Z" }];
  const blocks = [
    { business_id: "*", email: "old@shop.in", reason: "hard_bounce", detail: "mailbox bounce 5.1.1", created_at: "2026-11-23T05:10:00Z" },
    { business_id: "b1", email: "manual@co.in", reason: "manual", detail: null, created_at: "2026-11-22T05:00:00Z" },
    { business_id: "b1", email: "unsub@co.in", reason: "unsubscribed", detail: null, created_at: "2026-11-21T05:00:00Z" },
  ];
  const route: Route = (u, m) => {
    const email = u.searchParams.get("email");
    if (u.pathname.endsWith("/v1/sends")) return { sends: sends.filter((s) => !email || s.email === email) };
    if (u.pathname.endsWith("/v1/events")) return { events: [{ email: "old@shop.in", event: "hard_bounce", detail: "5.1.1", created_at: "2026-11-23T05:10:00Z" }] };
    if (u.pathname.endsWith("/v1/suppressions")) return { suppressions: blocks.filter((b) => !email || b.email === email) };
    if (m === "DELETE") return { ok: true };
    return null;
  };

  it("one address: its mail, whether it is blocked and why", async () => {
    backend(route);
    const el = await mount("the-mail-log");
    set(el, "email", "old@shop.in");
    q<HTMLElement>(el, '[data-action="search"]').click();
    await tick();
    expect(calls.some((c) => c.url === "/api/isuper/email-template/campaign/v1/sends?email=old%40shop.in&limit=100")).toBe(true);
    const t = text(el);
    expect(t).toContain("bounced");
    expect(t).toContain("old@shop.in is blocked for every sender: Address does not exist (bounce)");
    q<HTMLElement>(el, '[data-action="tab"][data-tab="events"]').click();
    await tick();
    expect(text(el)).toContain("Hard bounce");
  });

  it("block list: only addresses blocked by hand can be unblocked", async () => {
    backend(route);
    const el = await mount("the-mail-log");
    q<HTMLElement>(el, '[data-action="tab"][data-tab="blocked"]').click();
    await tick();
    const buttons = el.shadowRoot!.querySelectorAll<HTMLElement>('[data-action="unblock"]');
    expect([...buttons].map((b) => b.dataset["email"])).toEqual(["manual@co.in"]);
    globalThis.confirm = () => true;
    const got: any[] = [];
    el.addEventListener("the-unblocked", (e) => got.push((e as CustomEvent).detail));
    buttons[0].click();
    await tick();
    expect(calls.find((c) => c.method === "DELETE")!.url).toBe("/api/isuper/email-template/campaign/v1/suppressions/manual%40co.in");
    expect(got).toEqual([{ email: "manual@co.in" }]);
  });
});
