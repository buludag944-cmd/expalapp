/**
 * Verify Google Sign-In OAuth ID tokens (aud = *.googleusercontent.com).
 * Used when the client sends credential.idToken instead of a Firebase Auth JWT.
 */
const { OAuth2Client } = require("google-auth-library");

const DEFAULT_WEB_CLIENT_ID =
  "666367961302-gnvau78al8hnl4g05c95hibfl91b4n42.apps.googleusercontent.com";

function allowedAudiences() {
  const fromEnv = (process.env.GOOGLE_OAUTH_CLIENT_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const web = (process.env.GOOGLE_OAUTH_WEB_CLIENT_ID || DEFAULT_WEB_CLIENT_ID).trim();
  return [...new Set([web, ...fromEnv])];
}

function decodeJwtPayload(token) {
  const part = token.split(".")[1];
  if (!part) return null;
  const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  return JSON.parse(json);
}

function looksLikeGoogleOAuthToken(idToken) {
  try {
    const payload = decodeJwtPayload(idToken);
    const aud = String(payload?.aud || "");
    return aud.includes("googleusercontent.com");
  } catch {
    return false;
  }
}

async function verifyGoogleOAuthIdToken(idToken) {
  const client = new OAuth2Client();
  const audiences = allowedAudiences();
  const ticket = await client.verifyIdToken({ idToken, audience: audiences });
  const payload = ticket.getPayload();
  if (!payload?.email) {
    const err = new Error("Google account has no email.");
    err.code = "GOOGLE_NO_EMAIL";
    throw err;
  }
  return {
    uid: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
    firebase: { sign_in_provider: "google.com" },
  };
}

module.exports = { looksLikeGoogleOAuthToken, verifyGoogleOAuthIdToken };
