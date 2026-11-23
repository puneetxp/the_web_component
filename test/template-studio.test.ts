// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../src/mail/the-template-studio";

const ctx = {
  success: true,
  sources: { gst_new: "New GST businesses", existing: "Existing businesses" },
  goals: { intro: "Introduce services", service: "One service" },
  categories: ["IT, Software & Digital", "Trading, Wholesale & Retail"],
  templates: [{ id: 1, name: "gst-welcome", subject: "Welcome", enabled: true, summary: "Congratulations…" },
    { id: 2, name: "gst-returns", subject: "Returns", enabled: true, summary: "Monthly returns…" }],
  ai: { ready: true, remaining_today: 5, daily_limit: 10, provider: "gemini", model: "flash" },
};

let calls: { url: string; method: string; body: any; headers: Record<string, string> }[] = [];
function backend(routes: Record<string, (body: any) => any>) {
  calls = [];
  globalThis.fetch = vi.fn(async (url: any, init: any = {}) => {
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: String(url), method: init.method, body, headers: init.headers });
    const key = Object.keys(routes).find((k) => String(url).endsWith(k));
    const out = key ? routes[key](body) : { success: false, message: "no route" };
    return new Response(JSON.stringify(out), { status: out.success === false ? 400 : 200 });
  }) as any;
}
const tick = () => new Promise((r) => setTimeout(r, 0));
async function mount(attrs = 'api="https://app.test"') {
  document.body.innerHTML = `<the-template-studio ${attrs}></the-template-studio>`;
  const el = document.querySelector("the-template-studio")!;
  for (let i = 0; i < 5; i++) await tick();
  return el;
}
const $ = (el: Element, sel: string) => el.shadowRoot!.querySelector<HTMLElement>(sel)!;
const text = (el: Element) => el.shadowRoot!.textContent!.replace(/\s+/g, " ");

beforeEach(() => localStorage.setItem("session_id", "sess-123"));

describe("<the-template-studio>", () => {
  it("loads the context from the host backend with the user's session, no key", async () => {
    backend({ "/email-template/ai-context": () => ctx });
    const el = await mount();
    expect(calls[0].url).toBe("https://app.test/api/isuper/email-template/ai-context");
    expect(calls[0].headers["X-Session-Id"]).toBe("sess-123");
    expect(text(el)).toContain("AI: gemini · flash · 5 left today");
    expect(text(el)).toContain("compares your 2 templates");
    expect(el.shadowRoot!.querySelectorAll('select[data-model="category"] option').length).toBe(3);
  });

  it("ranks templates for the audience and sends use events", async () => {
    backend({
      "/email-template/ai-context": () => ctx,
      "/email-template/ai-choose": () => ({
        success: true, best_id: 1, advice: "Use the welcome mail.", draft_prompt: "p",
        ranking: [{ id: 1, name: "gst-welcome", score: 88, reason: "Fits new GST" }, { id: 2, name: "gst-returns", score: 50, reason: "One service" }],
      }),
    });
    const el = await mount();
    const cat = $(el, 'select[data-model="category"]') as HTMLSelectElement;
    cat.value = "IT, Software & Digital";
    cat.dispatchEvent(new Event("change", { bubbles: true }));
    const notes = $(el, 'textarea[data-model="notes"]') as HTMLTextAreaElement;
    notes.value = "Mention free first call";
    notes.dispatchEvent(new Event("input", { bubbles: true }));
    $(el, '[data-action="choose"]').click();
    for (let i = 0; i < 5; i++) await tick();
    expect(calls[1].body).toEqual({ source: "gst_new", category: "IT, Software & Digital", goal: "intro", service: "", notes: "Mention free first call" });
    expect(text(el)).toContain("Use the welcome mail.");
    expect(text(el)).toContain("best fit");
    const got: any[] = [];
    el.addEventListener("the-use-template", (e) => got.push((e as CustomEvent).detail));
    (el.shadowRoot!.querySelector('[data-action="use"][data-id="2"]') as HTMLElement).click();
    expect(got).toEqual([{ id: 2 }]);
  });

  it("drafts a new mail with AI, previews it safely, and hands it to the host", async () => {
    backend({
      "/email-template/ai-context": () => ctx,
      "/email/ai-template": () => ({
        success: true,
        email: { subject: "Hi <b>x</b>", heading: "Hello {name},", message: "Para one.\n\nPara <script>two</script>.", highlight: "Call us",
          buttonText: "Talk", buttonLink: "https://{host}/contact", signoff: "Team" },
      }),
    });
    const el = await mount();
    $(el, '[data-action="draft"]').click();
    for (let i = 0; i < 5; i++) await tick();
    expect(calls[1].body.prompt).toContain("Audience: New GST businesses");
    expect(el.shadowRoot!.querySelectorAll(".mail p").length).toBeGreaterThanOrEqual(3);
    expect(el.shadowRoot!.querySelector(".mail script")).toBeNull(); // escaped, never run
    expect(text(el)).toContain("Para <script>two</script>.");
    const saved: any[] = [];
    el.addEventListener("the-save-draft", (e) => saved.push((e as CustomEvent).detail));
    $(el, '[data-action="save"]').click();
    expect(saved[0].name).toBe("ai-gst_new-intro");
    expect(saved[0].subject).toBe("Hi <b>x</b>");
    expect(saved[0].fields.highlight).toBe("Call us");
    expect(text(el)).toContain('Saved as "ai-gst_new-intro" (inactive)');
  });

  it("shows backend errors and disables AI buttons when the app has no AI", async () => {
    backend({ "/email-template/ai-context": () => ({ ...ctx, ai: { ...ctx.ai, ready: false } }) });
    const el = await mount();
    expect(text(el)).toContain("AI not set up");
    expect(($(el, '[data-action="choose"]') as HTMLButtonElement).disabled).toBe(true);
    backend({ "/email-template/ai-context": () => ({ success: false, message: "You Are Not Login" }) });
    const el2 = await mount();
    expect(text(el2)).toContain("You Are Not Login");
  });

  it("takes its look from CSS variables and a theme attribute", async () => {
    backend({ "/email-template/ai-context": () => ctx });
    const el = await mount('theme="dark" style="--the-primary:#047857"');
    const css = el.shadowRoot!.querySelector("style")!.textContent!;
    expect(css).toContain("var(--the-primary, #4f46e5)");
    expect(css).toContain(':host([theme="dark"])');
  });
});
