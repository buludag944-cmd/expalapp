/**
 * Expal in-app assistant — uses OpenAI when OPENAI_API_KEY is set, else local tips.
 */

const APP_GUIDE = `
You are Expal's friendly assistant for expats. Expal helps people living abroad with:
- Home dashboard: phase, timeline tasks, mentor match, life abroad score
- Journey: relocation timeline, residency tracking, visa info
- Community: forum spaces and threads (create, edit, delete your own posts)
- Explore: housing, events, essentials, local know-how
- Messages: direct messages between members
- Profile: update destination, profession, bio

Sign-in is Google only on the web and app. Be concise (2-4 short paragraphs max). If unsure, suggest which app section to open. Do not make up legal advice; suggest official sources for visa/immigration questions.
`.trim();

function localAssistantReply(message, user) {
  const q = (message || "").toLowerCase();
  const city = user?.destinationCity || "your city";
  const country = user?.destinationCountry || "your country";

  if (/housing|rent|apartment|flat/.test(q)) {
    return `For housing, open **Explore** or check listings under housing in the app. Filter by ${city} when you can. Forum threads in Community often share landlord tips too.`;
  }
  if (/forum|thread|community|post/.test(q)) {
    return `Go to **Community** → pick a forum space → open a thread or tap **New thread**. You can **edit or delete** your own threads and replies from the thread page.`;
  }
  if (/journey|timeline|task|visa|residency|pr |permanent/.test(q)) {
    return `Open **Journey** for your relocation timeline and residency tools. Your dashboard **Home** shows urgent tasks for your current phase in ${country}.`;
  }
  if (/mentor|match/.test(q)) {
    return `Check **Home** for your mentor match, or browse **Members** / search from the header.`;
  }
  if (/message|chat|dm/.test(q)) {
    return `Use **Messages** in the bottom nav to read and send direct messages.`;
  }
  if (/login|sign|google|password/.test(q)) {
    return `Sign in with **Continue with Google** on the login screen. Expal does not use email/password sign-up.`;
  }
  if (/profile|setting|account/.test(q)) {
    return `Open **Profile** to update your city (${city}), profession, bio, and photo.`;
  }
  return `Hi! I'm Expal's helper. Ask about **Community** forums, **Journey** / visa timeline, **housing**, **events**, or **messages**. You're set up for ${city}, ${country} — what do you want to do first?`;
}

async function openAiReply(message, user) {
  const key = (process.env.OPENAI_API_KEY || "").trim();
  if (!key) return null;

  const model = (process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
  const userContext = user
    ? `User context: ${user.firstName || "Member"}, phase=${user.phase || "unknown"}, destination=${user.destinationCity || "?"}, ${user.destinationCountry || "?"}.`
    : "";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: `${APP_GUIDE}\n${userContext}` },
        { role: "user", content: String(message).slice(0, 4000) },
      ],
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

async function getAssistantReply(message, user) {
  try {
    const ai = await openAiReply(message, user);
    if (ai) return { reply: ai, source: "openai" };
  } catch (err) {
    console.warn("[assistant] OpenAI failed:", err.message || err);
  }
  return { reply: localAssistantReply(message, user), source: "local" };
}

module.exports = { getAssistantReply };
