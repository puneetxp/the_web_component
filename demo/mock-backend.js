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
