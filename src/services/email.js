const nodemailer = require("nodemailer");

/**
 * Real SMTP only (no Ethereal). Set SMTP_* in backend/.env — see backend/.env.example.
 *
 * Gmail:
 *   1. Enable 2-Step Verification on your Google account.
 *   2. Create an App Password (Google Account → Security → App passwords).
 *   3. SMTP_HOST=smtp.gmail.com  SMTP_PORT=587  SMTP_SECURE=false
 *      SMTP_USER=you@gmail.com  SMTP_PASS=<16-char app password>
 *      MAIL_FROM="EXPal" <you@gmail.com>
 *
 * Brevo / Mailgun / Mailersend:
 *   Use SMTP host, port, user, and password from the provider dashboard.
 *   MAIL_FROM must be a verified sender domain/address.
 *   For production, configure SPF and DKIM on your domain for deliverability.
 */

let cachedTransport = null;
let startupLogged = false;

function smtpHostConfigured() {
  const h = process.env.SMTP_HOST;
  return !!(h && String(h).trim());
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
      "SMTP_HOST is not set. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and MAIL_FROM to backend/.env (see .env.example)."
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

/** Log transport status when the server boots (warn if SMTP is missing). */
function initEmailTransport() {
  if (!smtpHostConfigured()) {
    console.warn(
      "[email] SMTP_HOST not set — verification emails will fail until backend/.env is configured."
    );
    return;
  }
  getSmtpTransport();
}

/**
 * Send account verification email via SMTP.
 * Link: CLIENT_URL/verify/<token> (token is URL-encoded in the path).
 */
async function sendVerificationEmail(toEmail, verifyToken) {
  const clientUrl = (process.env.CLIENT_URL || "http://localhost:3000").replace(/\/$/, "");
  const tokenInPath = encodeURIComponent(verifyToken);
  const link = `${clientUrl}/verify/${tokenInPath}`;

  const transport = getSmtpTransport();

  const mail = {
    from: process.env.MAIL_FROM || '"EXPal" <noreply@expal.local>',
    to: toEmail,
    subject: "Verify your EXPal account",
    text: `Click here to activate your account\n\n${link}\n`,
    html: `<p>Click here to activate your account</p><p><a href="${link}">${link}</a></p>`,
  };

  try {
    const info = await transport.sendMail(mail);
    console.log("[email] SMTP accepted message", info.messageId ?? "(no id)");
    return info;
  } catch (err) {
    const detail = err && err.message ? err.message : String(err);
    console.error(`[email] sendMail failed: ${detail}`);
    throw err;
  }
}

/**
 * Password reset email — link: CLIENT_URL/reset/<token> (60 min TTL set in auth route).
 */
async function sendResetEmail({ to, link }) {
  const transport = getSmtpTransport();
  const subject = "Reset your EXPal password";
  const html = `
    <p>You requested a password reset.</p>
    <p>Click <a href="${link}">this secure link</a> to set a new password (valid for 60 minutes).</p>
    <p>If you didn't request this, you can ignore this email.</p>
  `;
  const text = `You requested a password reset.\n\n${link}\n\nValid for 60 minutes. If you didn't request this, ignore this email.`;

  const info = await transport.sendMail({
    to,
    from: process.env.MAIL_FROM || '"EXPal" <noreply@expal.local>',
    subject,
    html,
    text,
  });
  console.log("[reset] reset email sent to", to);
  console.log("[email] SMTP accepted message", info.messageId ?? "(no id)");
  return info;
}

module.exports = {
  sendVerificationEmail,
  sendResetEmail,
  initEmailTransport,
  smtpHostConfigured,
};
