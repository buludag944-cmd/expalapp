/**
 * Expal in-app assistant — OpenAI when OPENAI_API_KEY is set, else smart local navigation help.
 */

const APP_GUIDE = `
You are Expal's relocation assistant for expats in Ireland and Europe. You give practical, friendly answers — not just app navigation.

You CAN help with:
- Ireland visa pathways: CSEP (Critical Skills Employment Permit), General Work Permit, EU Passport / EU citizen rights
- Step-by-step relocation admin (IRP registration, PPS number, bank account, tax)
- How to use Expal features (Journey visa guide, timeline, Community forums, housing, events)
- General expat life questions (housing search tips, settling in, career)

Rules:
- Be concise (2–5 short paragraphs). Use **bold** for section names.
- For legal/immigration specifics, mention official sources (enterprise.gov.ie, irishimmigration.ie) and note rules change — you are not a lawyer.
- If the user has a visa type in their profile, tailor advice to that pathway.
- Answer the actual question; don't only tell them which app tab to open unless they ask for navigation.
`.trim();

const TOPICS = [
  {
    re: /csep|critical skills|critical skills employment permit/,
    reply: (u) =>
      `**CSEP (Critical Skills Employment Permit)** is for roles on Ireland's Critical Skills list with qualifying salary. Your employer applies via DETE before you travel.

Key steps: permit approval → travel → **IRP registration within 90 days** → **PPS number** → bank account. After ~21 months on CSEP you may qualify for **Stamp 4** (verify current rules).

Open **Journey → Visa guide** in Expal for your personalised checklist${
        u?.visaType?.includes("CSEP") ? " — your profile is set to CSEP." : ". Set visa type to CSEP in **Profile** if this applies to you."
      } Official info: enterprise.gov.ie`,
  },
  {
    re: /general work permit|general employment|lmnt|labour market needs test/,
    reply: (u) =>
      `**General Work Permit** applies when the role is not on the Critical Skills list. Employers usually need a **Labour Market Needs Test** (job advertised to EU candidates first). Processing can take months.

After approval: entry visa (if needed) → arrival → **IRP registration** → PPS → employment. Renew **3–6 months before expiry**.

See **Journey → Visa guide** for your step list${
        u?.visaType?.includes("General") ? " (your profile: General Work Permit)." : "."
      }`,
  },
  {
    re: /eu passport|eu citizen|eea|freedom of movement|stamp 4 eu/,
    reply: (u) =>
      `**EU/EEA/Swiss citizens** can live and work in Ireland **without an employment permit**. Bring valid passport or national ID.

Still needed: **PPS number**, Irish **bank account**, tax registration, and possibly **residence registration** if staying 3+ months.

Expal **Journey → Visa guide** has the EU pathway checklist${
        u?.visaType?.includes("EU") ? " — matches your profile." : ". Update **Profile → Visa type** if you're an EU citizen."
      }`,
  },
  {
    re: /housing|rent|apartment|flat|landlord|lease|roommate/,
    reply: (u) =>
      `Open **Explore → Housing** to browse and post listings. ${
        u?.destinationCity ? `Search around **${u.destinationCity}**.` : "Add your city in Profile."
      } Daft.ie and Facebook groups are common in Ireland — forums in **Community** share landlord tips.`,
  },
  {
    re: /forum|thread|community|post a|new thread/,
    reply: () =>
      `**Community** → pick a forum space → **New thread** or open existing threads. You can edit/delete your own posts.`,
  },
  {
    re: /visa guide|visa type|change visa|permit type/,
    reply: (u) =>
      `Open **Journey → Visa guide** for a step-by-step checklist${
        u?.visaType ? ` for **${u.visaType}**` : ""
      }. To switch pathway (CSEP / General Work Permit / EU Passport), go to **Profile → Visa & relocation** and tap **Update visa type** — your timeline refreshes automatically.`,
  },
  {
    re: /journey|timeline|task|checklist|irp|gnib|pps/,
    reply: (u) =>
      `**Journey** has your **Visa guide** (personalised steps) and **Timeline** (dated tasks). For IRP/GNIB registration and PPS, check the Visa guide tab first${
        u?.destinationCountry === "Ireland" ? " — Ireland-specific steps included." : "."
      }`,
  },
  {
    re: /login|sign|google|session/,
    reply: () =>
      `Sign in with **Continue with Google**. Profile data is stored on the server — use the same Google account each time.`,
  },
  {
    re: /explore|where is|how do i find|navigate|menu/,
    reply: () =>
      `**Home** (dashboard) · **Journey** (visa guide + timeline) · **Explore** (housing, events) · **Community** (forums) · **Profile** (visa type, bio). What do you need help with?`,
  },
];

function pickTopic(message) {
  const q = (message || "").toLowerCase();
  return TOPICS.find((t) => t.re.test(q)) || null;
}

function contextualFallback(message, user) {
  const q = (message || "").toLowerCase().trim();
  const visa = user?.visaType || null;
  const place = user?.destinationCity
    ? `${user.destinationCity}, ${user.destinationCountry || "Ireland"}`
    : user?.destinationCountry || null;

  if (/^(hi|hello|hey|help)[!.?\s]*$/i.test(q)) {
    return visa
      ? `Hi! You're on the **${visa}** pathway${place ? ` for ${place}` : ""}. Ask me about permit steps, IRP/PPS, housing, or say "show visa guide".`
      : `Hi! Ask about **CSEP**, **General Work Permit**, or **EU Passport** routes — or set your visa type in Profile for tailored answers.`;
  }

  return place
    ? `I'm not sure about "${message.slice(0, 80)}". For ${place}, try **Journey → Visa guide** or ask a specific question about your permit, housing, or timeline.`
    : `Try asking about **CSEP**, **General Work Permit**, **EU Passport**, or **Journey → Visa guide**. Be specific and I'll help.`;
}

function localAssistantReply(message, user, _history = []) {
  const topic = pickTopic(message);
  if (topic) return topic.reply(user);
  return contextualFallback(message, user);
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
    .slice(-10)
    .map((m) => ({
      role: m.role,
      content: String(m.content).slice(0, 2000),
    }));
}

function buildUserContext(user) {
  if (!user) return "";
  const parts = [
    user.firstName ? `Name: ${user.firstName}` : null,
    user.phase ? `Phase: ${user.phase}` : null,
    user.destinationCountry ? `Country: ${user.destinationCountry}` : null,
    user.destinationCity ? `City: ${user.destinationCity}` : null,
    user.visaType ? `Visa/permit type: ${user.visaType}` : null,
    user.profession ? `Profession: ${user.profession}` : null,
  ].filter(Boolean);
  return parts.length ? `User profile: ${parts.join(" · ")}.` : "";
}

async function openAiReply(message, user, history = []) {
  const key = (process.env.OPENAI_API_KEY || "").trim();
  if (!key) return null;

  const model = (process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
  const userContext = buildUserContext(user);

  const prior = normalizeHistory(history);
  const messages = [
    { role: "system", content: `${APP_GUIDE}\n${userContext}` },
    ...prior,
    { role: "user", content: String(message).slice(0, 4000) },
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 800,
      temperature: 0.7,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.error?.message || res.statusText;
    throw new Error(detail || "OpenAI request failed");
  }
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty response from assistant");
  return text;
}

async function getAssistantReply(message, user, history = []) {
  let openaiError = null;
  try {
    const ai = await openAiReply(message, user, history);
    if (ai) return { reply: ai, source: "openai", openaiError: null };
  } catch (err) {
    openaiError = err.message || String(err);
    console.warn("[assistant] OpenAI failed:", openaiError);
  }
  return {
    reply: localAssistantReply(message, user, history),
    source: "local",
    openaiError,
  };
}

function isOpenAiConfigured() {
  return !!(process.env.OPENAI_API_KEY || "").trim();
}

module.exports = { getAssistantReply, isOpenAiConfigured };
