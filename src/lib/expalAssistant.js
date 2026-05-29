/**
 * Expal in-app assistant — OpenAI when OPENAI_API_KEY is set, else smart local navigation help.
 */

const APP_GUIDE = `
You are Expal's friendly assistant for expats. Expal helps people living abroad with:
- Home dashboard: phase, timeline tasks, mentor match, life abroad score
- Journey: relocation timeline, residency tracking, visa info
- Community: forum spaces and threads (create, edit, delete your own posts)
- Explore: housing, events, referrals, essentials, local know-how
- Messages: direct messages between members
- Profile: update destination, profession, bio

Sign-in is Google only on the web and app. Be concise (2-4 short paragraphs max). Answer the user's actual question. If unsure, suggest which app section to open. Do not make up legal advice; suggest official sources for visa/immigration questions.
`.trim();

const TOPICS = [
  {
    re: /housing|rent|apartment|flat|landlord|lease|roommate/,
    reply: (u) =>
      `Open **Explore** from the bottom nav, then **Housing**. You can browse listings and post your own. ${
        u?.destinationCity ? `Filter or search for **${u.destinationCity}** when you can.` : "Add your city in **Profile** for better matches."
      } Community forums also share landlord tips.`,
  },
  {
    re: /forum|thread|community|post a|new thread|reply|edit.*thread|delete.*thread/,
    reply: () =>
      `Go to **Community** → choose a forum space → open a thread or tap **New thread**. On a thread page you can **edit or delete** your own posts and replies.`,
  },
  {
    re: /event|meetup|calendar|gathering|community event/,
    reply: (u) =>
      `Open **Explore** → **Events** to see upcoming meetups or add your own. You can **edit or delete** events you created. ${
        u?.destinationCity ? `Great for meeting people in ${u.destinationCity}.` : ""
      }`,
  },
  {
    re: /referral|recommend|introduction|job lead|service provider/,
    reply: () =>
      `Open **Explore** → **Referrals** to ask for or share trusted contacts and job leads. You can **edit or delete** referrals you posted.`,
  },
  {
    re: /journey|timeline|task|checklist|relocation plan/,
    reply: (u) =>
      `Open **Journey** for your relocation timeline and task checklist. **Home** shows urgent tasks for your current phase${
        u?.destinationCountry ? ` in ${u.destinationCountry}` : ""
      }.`,
  },
  {
    re: /visa|residency|pr\b|permanent resident|citizenship|absence|immigration/,
    reply: (u) =>
      `Open **Journey** for residency tracking and timeline tasks. For official visa rules, always check your destination's government site — I can't give legal advice. ${
        u?.destinationCountry ? `Your profile shows **${u.destinationCountry}** as destination.` : "Set your destination in **Profile** first."
      }`,
  },
  {
    re: /mentor|match|buddy|connect with/,
    reply: () =>
      `Check **Home** for your mentor match card. You can also search members from the header **Search** icon or browse profiles.`,
  },
  {
    re: /message|chat|dm|inbox|direct message/,
    reply: () =>
      `Tap **Messages** in the bottom nav (desktop sidebar) to read and send direct messages to other members.`,
  },
  {
    re: /profile|setting|account|photo|bio|destination city|onboarding/,
    reply: (u) =>
      `Open **Profile** to update your photo, bio, profession, and destination${
        u?.destinationCity ? ` (currently ${u.destinationCity})` : ""
      }. Complete onboarding there if you skipped it.`,
  },
  {
    re: /essential|checklist|expat essential/,
    reply: () =>
      `Open **Explore** → **Expat essentials** for curated relocation checklists and tips.`,
  },
  {
    re: /know.?how|local tip|culture|custom/,
    reply: () =>
      `Open **Explore** → **Local know-how** for culture and practical tips from other expats.`,
  },
  {
    re: /home|dashboard|phase|life abroad|score/,
    reply: (u) =>
      `**Home** shows your relocation phase, urgent tasks, mentor match, and life abroad score. ${
        u?.phase ? `You're currently in the **${u.phase}** phase.` : ""
      }`,
  },
  {
    re: /login|sign|google|password|account deleted|logged out|session/,
    reply: () =>
      `Sign in with **Continue with Google** only — no email/password sign-up. If you were logged out after a server redeploy, your Google account is fine; sign in again. **Profile data** is stored on the server — if the API database was reset, you may need to re-complete onboarding.`,
  },
  {
    re: /explore|where is|how do i find|navigate|menu|tab/,
    reply: () =>
      `Main areas: **Home** (dashboard), **Explore** (housing, events, referrals, essentials), **Community** (forums), **Journey** (timeline & visa tools), **Messages**, **Profile**. What are you trying to do?`,
  },
];

function pickTopic(message) {
  const q = (message || "").toLowerCase();
  return TOPICS.find((t) => t.re.test(q)) || null;
}

function contextualFallback(message, user) {
  const q = (message || "").toLowerCase().trim();
  const city = user?.destinationCity || null;
  const country = user?.destinationCountry || null;
  const place =
    city && country ? `${city}, ${country}` : city || country || null;

  if (/^(hi|hello|hey|yo|help|start)[!.?\s]*$/i.test(q)) {
    return place
      ? `Hi! You're set up for **${place}**. Ask me things like "How do I post in the forum?", "Where are events?", or "Show me housing".`
      : `Hi! Ask me things like "How do I post in the forum?", "Where is the visa timeline?", or "How do I add an event?" — I'll point you to the right part of Expal.`;
  }

  if (/how (do|can|to)|where (is|do|can)|what is|can i|show me|find/.test(q)) {
    return `I didn't match that to a specific section yet. Try asking about **Community** (forums), **Journey** (visa/timeline), **Explore** (housing, events, referrals), **Messages**, or **Profile**. What are you trying to accomplish?`;
  }

  return place
    ? `I'm not sure about "${message.slice(0, 80)}". For ${place}, try **Explore** (housing/events), **Community** (forums), or **Journey** (timeline). Rephrase your question and I'll guide you.`
    : `I'm not sure about "${message.slice(0, 80)}". Try asking about forums, housing, events, Journey/visa timeline, or messages — be specific and I'll point you there.`;
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
    .slice(-8)
    .map((m) => ({
      role: m.role,
      content: String(m.content).slice(0, 2000),
    }));
}

async function openAiReply(message, user, history = []) {
  const key = (process.env.OPENAI_API_KEY || "").trim();
  if (!key) return null;

  const model = (process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
  const userContext = user
    ? `User context: ${user.firstName || "Member"}, phase=${user.phase || "unknown"}, destination=${user.destinationCity || "?"}, ${user.destinationCountry || "?"}.`
    : "";

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
      max_tokens: 500,
      temperature: 0.6,
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
  try {
    const ai = await openAiReply(message, user, history);
    if (ai) return { reply: ai, source: "openai" };
  } catch (err) {
    console.warn("[assistant] OpenAI failed:", err.message || err);
  }
  return { reply: localAssistantReply(message, user, history), source: "local" };
}

function isOpenAiConfigured() {
  return !!(process.env.OPENAI_API_KEY || "").trim();
}

module.exports = { getAssistantReply, isOpenAiConfigured };
