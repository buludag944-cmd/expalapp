/**
 * Expal assistant — free built-in visa guide (default).
 * OpenAI is optional and OFF unless OPENAI_ENABLED=true on the server.
 */

const { getVisaGuide, normalizeVisaType } = require("./visaGuide");

function formatGuideReply(guide, user) {
  if (!guide) return null;
  const lines = [
    `**${guide.shortLabel || guide.visaType}**`,
    guide.tagline || "",
    "",
    "**Your steps:**",
  ];
  (guide.steps || []).slice(0, 8).forEach((s, i) => {
    lines.push(`${i + 1}. **${s.title}** — ${s.description}`);
  });
  if (guide.tips?.length) {
    lines.push("", "**Tips:**", ...guide.tips.map((t) => `• ${t}`));
  }
  lines.push(
    "",
    "Full checklist: **Journey → Visa guide** in the app.",
    guide.officialUrl ? `Official source: ${guide.officialUrl}` : ""
  );
  return lines.filter(Boolean).join("\n");
}

function replyForUserVisa(user) {
  const country = user?.destinationCountry || "Ireland";
  const visaType = normalizeVisaType(user?.visaType);
  if (!visaType) return null;
  const guide = getVisaGuide(country, visaType);
  return formatGuideReply(guide, user);
}

const TOPICS = [
  {
    re: /csep|critical skills|critical skills employment permit/,
    reply: (u) =>
      formatGuideReply(getVisaGuide(u?.destinationCountry || "Ireland", "CSEP (Critical Skills Employment Permit)"), u) ||
      "CSEP is for roles on Ireland's Critical Skills list. See **Journey → Visa guide**.",
  },
  {
    re: /general work permit|general employment|lmnt|labour market needs test/,
    reply: (u) =>
      formatGuideReply(getVisaGuide(u?.destinationCountry || "Ireland", "General Work Permit"), u) ||
      "General Work Permit info is in **Journey → Visa guide**.",
  },
  {
    re: /eu passport|eu citizen|eea|freedom of movement/,
    reply: (u) =>
      formatGuideReply(getVisaGuide(u?.destinationCountry || "Ireland", "EU Passport / EU Citizen"), u) ||
      "EU citizens don't need an employment permit in Ireland. See **Journey → Visa guide**.",
  },
  {
    re: /irp|gnib|immigration registration|register.*(arrival|immigration)/,
    reply: () =>
      `**IRP (Irish Residence Permit)** — register within **90 days** of arrival.

Bring: passport, permit approval letter (if non-EU), proof of address, employer letter.

Book via irishimmigration.ie — Dublin slots fill fast. After registration you get your stamp.

Your dated tasks are in **Journey → Timeline**.`,
  },
  {
    re: /pps|personal public service|tax number/,
    reply: () =>
      `**PPS number** — needed for work, tax, and most admin in Ireland.

Apply at your local Intreo centre or designated office. Usually need: photo ID, proof of address, reason for PPS (employment letter helps).

You can't be paid legally on payroll without one. Add "Apply for PPS" on your **Journey → Timeline** if it's there.`,
  },
  {
    re: /bank account|open a bank|irish bank/,
    reply: (u) =>
      `To open an Irish **bank account**, banks typically want:

• Passport + IRP card (or appointment letter)
• Proof of address (utility bill or lease)
• PPS letter or employment contract

Some banks accept a letter from your employer before IRP arrives. Ask colleagues in **Community** forums for ${u?.destinationCity || "your city"}.`,
  },
  {
    re: /stamp 4|switch employer|change job/,
    reply: (u) =>
      u?.visaType?.includes("CSEP")
        ? `On **CSEP**, after ~21 months with the same employer you may apply for **Stamp 4** (check current rules on irishimmigration.ie). Stamp 4 gives more flexibility to change jobs.

Changing employer on an active permit usually needs a **new permit application** before starting the new role.`
        : `Permit holders: changing employer often requires a **new employment permit** before you start. EU citizens have more flexibility. Check **Journey → Visa guide** for your pathway.`,
  },
  {
    re: /renew|expir|extension/,
    reply: (u) =>
      u?.visaType?.includes("General")
        ? `**General Work Permit** renewals: start **3–6 months before expiry**. Employer usually leads the application. Keep payslips and tax records from day one.`
        : `Start renewal paperwork **well before** permit expiry. Your employer often submits the application. Track the date in **Journey → Timeline**.`,
  },
  {
    re: /document|paperwork|what (do i|should i) bring/,
    reply: () =>
      `Common documents for Ireland relocation:

• Passport (6+ months validity)
• Employment permit approval letter
• Signed job contract
• Qualifications (certified copies)
• Proof of address
• Passport photos

Non-EU: entry visa if your nationality requires it. Full list in **Journey → Visa guide**.`,
  },
  {
    re: /housing|rent|apartment|flat|daft|landlord/,
    reply: (u) =>
      `**Housing in Ireland:** Daft.ie is the main site. Also Facebook groups and **Explore → Housing** in Expal.

Expect: deposit + first month rent, references, sometimes employer letter. ${
        u?.destinationCity ? `Search **${u.destinationCity}** first.` : "Set your city in Profile."
      } Scams exist — never pay deposit before viewing.`,
  },
  {
    re: /forum|thread|community|post/,
    reply: () =>
      `**Community** → choose a forum → **New thread** or reply. Edit/delete your own posts from the thread page.`,
  },
  {
    re: /visa guide|my steps|checklist|what('s| is) next/,
    reply: (u) => replyForUserVisa(u) || `Set your visa type in **Profile → Visa & relocation**, then open **Journey → Visa guide**.`,
  },
  {
    re: /change visa|visa type|switch.*permit/,
    reply: () =>
      `**Profile → Visa & relocation** → pick CSEP, General Work Permit, or EU Passport → **Update visa type**. Your timeline and visa guide refresh automatically.`,
  },
  {
    re: /journey|timeline|task/,
    reply: (u) =>
      `**Journey → Visa guide** = step-by-step for ${u?.visaType || "your permit"}.\n**Journey → Timeline** = dated tasks (IRP, PPS, bank, etc.).`,
  },
  {
    re: /login|sign|google/,
    reply: () => `Sign in with **Continue with Google**. Use the same account each time — your profile is saved on the server.`,
  },
  {
    re: /explore|where|navigate|menu/,
    reply: () =>
      `**Home** · **Journey** (visa guide) · **Explore** (housing, events) · **Community** · **Profile** (visa type).`,
  },
];

function pickTopic(message) {
  return TOPICS.find((t) => t.re.test((message || "").toLowerCase())) || null;
}

function contextualFallback(message, user) {
  const q = (message || "").toLowerCase().trim();
  const visa = user?.visaType || null;
  const place = user?.destinationCity
    ? `${user.destinationCity}, ${user.destinationCountry || "Ireland"}`
    : user?.destinationCountry || null;

  if (/^(hi|hello|hey|help|start)[!.?\s]*$/i.test(q)) {
    if (visa) {
      const guide = replyForUserVisa(user);
      return guide
        ? `Hi${user.firstName ? ` ${user.firstName}` : ""}! Here's your pathway:\n\n${guide}`
        : `Hi! You're on **${visa}**${place ? ` in ${place}` : ""}. Ask about IRP, PPS, bank account, housing, or say "my steps".`;
    }
    return `Hi! I help with **CSEP**, **General Work Permit**, and **EU Passport** routes in Ireland. Ask "what is CSEP?" or set your visa type in Profile for a personalised guide.`;
  }

  if (visa && /step|guide|path|process|how do i move/.test(q)) {
    const guide = replyForUserVisa(user);
    if (guide) return guide;
  }

  return place
    ? `Try asking about **IRP registration**, **PPS**, **bank account**, or **${visa || "your permit"} steps**. Or open **Journey → Visa guide** for ${place}.`
    : `Ask about **CSEP**, **General Work Permit**, **EU Passport**, **IRP**, or **PPS** — or set your visa type in Profile.`;
}

function localAssistantReply(message, user, _history = []) {
  const topic = pickTopic(message);
  if (topic) return topic.reply(user);
  return contextualFallback(message, user);
}

function openAiEnabled() {
  return (
    (process.env.OPENAI_ENABLED || "").toLowerCase() === "true" &&
    !!(process.env.OPENAI_API_KEY || "").trim()
  );
}

async function openAiReply(message, user, history = []) {
  if (!openAiEnabled()) return null;

  const key = (process.env.OPENAI_API_KEY || "").trim();
  const model = (process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
  const ctx = user
    ? `User: ${user.firstName || "Member"}, visa=${user.visaType || "?"}, ${user.destinationCity || "?"}, ${user.destinationCountry || "Ireland"}`
    : "";

  const prior = (Array.isArray(history) ? history : [])
    .filter((m) => m?.role && m?.content)
    .slice(-8)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) }));

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: `Expal relocation assistant for Ireland. ${ctx}` },
        ...prior,
        { role: "user", content: String(message).slice(0, 4000) },
      ],
      max_tokens: 800,
      temperature: 0.7,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || "OpenAI request failed");
  return data.choices?.[0]?.message?.content?.trim() || null;
}

async function getAssistantReply(message, user, history = []) {
  if (openAiEnabled()) {
    try {
      const ai = await openAiReply(message, user, history);
      if (ai) return { reply: ai, source: "openai", openaiError: null };
    } catch (err) {
      console.warn("[assistant] OpenAI skipped:", err.message || err);
    }
  }
  return {
    reply: localAssistantReply(message, user, history),
    source: "guide",
    openaiError: null,
  };
}

function isOpenAiConfigured() {
  return openAiEnabled();
}

module.exports = { getAssistantReply, isOpenAiConfigured, localAssistantReply };
