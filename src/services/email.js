const nodemailer = require("nodemailer");

/**
 * Email delivery:
 * - Render FREE tier blocks outbound SMTP (ports 25/465/587) → use Resend (HTTPS).
 * - Local dev: SMTP (Gmail) or Resend.
 *
 * Resend (production on Render free):
 *   RESEND_API_KEY=re_...
 *   MAIL_FROM=EXPal <onboarding@resend.dev>   (testing — only to your Resend account email)
 *   Or verify a domain at resend.com for any recipient.
 *
 * Gmail SMTP (local Mac only — blocked on Render free):
 *   SMTP_HOST=smtp.gmail.com SMTP_PORT=587 SMTP_SECURE=false
 *   SMTP_USER=... SMTP_PASS=<app password> MAIL_FROM="EXPal" <you@gmail.com>
 */

let cachedTransport = null;
let startupLogged = false;

function resendApiKeyConfigured() {
  return !!(process.env.RESEND_API_KEY || "").trim();
}

function smtpHostConfigured() {
  const h = process.env.SMTP_HOST;
  return !!(h && String(h).trim());
}

/** True when Resend API or SMTP is configured. */
function emailDeliveryConfigured() {
  return resendApiKeyConfigured() || smtpHostConfigured();
}

function parseSmtpSecure() {
  const v = process.env.SMTP_SECURE;
  if (v === undefined || v === "") return false;
  return v === "true" || v === "1";
}

function getSmtpTransport() {
  const host = (process.env.SMTP_HOST || "").trim();
  if (!host) {
    throw new Error(
      "SMTP_HOST is not set. Use RESEND_API_KEY on Render free tier, or SMTP_* locally."
    );
  }

  if (!cachedTransport) {
    const port = Number(process.env.SMTP_PORT) || 587;
    const secure = parseSmtpSecure();
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    cachedTransport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });

    if (!startupLogged) {
      console.log(
        `[email] Using SMTP transport: host=${host} port=${port} secure=${secure}`
      );
      startupLogged = true;
    }
  }

  return cachedTransport;
}

async function sendViaResend({ to, subject, html, text }) {
  const key = (process.env.RESEND_API_KEY || "").trim();
  if (!key) {
    throw new Error("RESEND_API_KEY is not set");
  }
  const from = process.env.MAIL_FROM || "EXPal <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.message || data.error || JSON.stringify(data);
    throw new Error(`Resend API ${res.status}: ${detail}`);
  }
  console.log("[email] Resend accepted message", data.id ?? "(no id)");
  return data;
}

async function sendMailMessage({ to, subject, html, text }) {
  if (resendApiKeyConfigured()) {
    return sendViaResend({ to, subject, html, text });
  }
  const transport = getSmtpTransport();
  const info = await transport.sendMail({
    from: process.env.MAIL_FROM || '"EXPal" <noreply@expal.local>',
    to,
    subject,
    html,
    text,
  });
  console.log("[email] SMTP accepted message", info.messageId ?? "(no id)");
  return info;
}

function initEmailTransport() {
  if (resendApiKeyConfigured()) {
    console.log("[email] Using Resend HTTP API (works on Render free tier)");
    startupLogged = true;
    return;
  }
  if (!smtpHostConfigured()) {
    console.warn(
      "[email] No RESEND_API_KEY or SMTP_HOST — verification/reset emails disabled until configured."
    );
    return;
  }
  getSmtpTransport();
}

async function sendVerificationEmail(toEmail, verifyToken) {
  const clientUrl = (process.env.CLIENT_URL || "http://localhost:3000").replace(/\/$/, "");
  const tokenInPath = encodeURIComponent(verifyToken);
  const link = `${clientUrl}/verify/${tokenInPath}`;

  try {
    return await sendMailMessage({
      to: toEmail,
      subject: "Verify your EXPal account",
      text: `Click here to activate your account\n\n${link}\n`,
      html: `<p>Click here to activate your account</p><p><a href="${link}">${link}</a></p>`,
    });
  } catch (err) {
    const detail = err && err.message ? err.message : String(err);
    console.error(`[email] send failed: ${detail}`);
    throw err;
  }
}

async function sendResetEmail({ to, link }) {
  const subject = "Reset your EXPal password";
  const html = `
    <p>You requested a password reset.</p>
    <p>Click <a href="${link}">this secure link</a> to set a new password (valid for 60 minutes).</p>
    <p>If you didn't request this, you can ignore this email.</p>
  `;
  const text = `You requested a password reset.\n\n${link}\n\nValid for 60 minutes. If you didn't request this, ignore this email.`;

  try {
    await sendMailMessage({ to, subject, html, text });
    console.log("[reset] reset email sent to", to);
  } catch (err) {
    const detail = err && err.message ? err.message : String(err);
    console.error(`[email] send failed: ${detail}`);
    throw err;
  }
}

/** Account uses Google sign-in only — no password to reset. */
async function sendGoogleSignInReminderEmail({ to, loginUrl }) {
  const subject = "Sign in to Expal with Google";
  const html = `
    <p>Your Expal account uses <strong>Continue with Google</strong> — there is no separate password to reset.</p>
    <p><a href="${loginUrl}">Open Expal and sign in with Google</a></p>
    <p>If you did not request this, you can ignore this email.</p>
  `;
  const text = `Your Expal account uses Google sign-in — no password to reset.\n\nSign in: ${loginUrl}\n`;

  await sendMailMessage({ to, subject, html, text });
  console.log("[forgot] Google sign-in reminder sent to", to);
}

/** Safe status for /health (no secrets). */
function getEmailStatus() {
  const resend = resendApiKeyConfigured();
  const smtp = smtpHostConfigured();
  let hint =
    "Add RESEND_API_KEY on Render (see backend/EMAIL_RENDER.md). SMTP is blocked on Render free tier.";
  if (resend) {
    hint =
      "Resend active. Free tier: onboarding@resend.dev only delivers to your Resend account email until you verify a domain.";
  } else if (smtp) {
    hint =
      "SMTP vars set but Resend not configured — outbound SMTP usually fails on Render; add RESEND_API_KEY.";
  }
  return {
    configured: emailDeliveryConfigured(),
    resend,
    smtp,
    mailFromSet: !!(process.env.MAIL_FROM || "").trim(),
    hint,
  };
}

module.exports = {
  sendVerificationEmail,
  sendResetEmail,
  sendGoogleSignInReminderEmail,
  initEmailTransport,
  smtpHostConfigured,
  emailDeliveryConfigured,
  resendApiKeyConfigured,
  getEmailStatus,
};
