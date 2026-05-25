/**
 * Auth handlers: registration with email verification (isVerified + verifyToken),
 * login (verified users only), and /api/auth/* routes (verify, resend).
 * Wired from server.js: POST /api/register, POST /api/login, app.use("/api/auth", authRouter)
 */
const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { fn, col, where } = require("sequelize");
const { User } = require("../bootstrapModels");
const jwt = require("jsonwebtoken");
const { issueAuthTokenPayload, JWT_SECRET } = require("../config/jwt");
const {
  sendVerificationEmail,
  sendResetEmail,
  emailDeliveryConfigured,
} = require("../services/email");

const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
/** Password reset link TTL — configurable; default 60 minutes. */
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;

// TODO: replace with Redis or express-rate-limit for production.
const forgotRateByIp = new Map();
const FORGOT_RATE_WINDOW_MS = 15 * 60 * 1000;
const FORGOT_RATE_MAX = 10;

function forgotRateLimitOk(ip) {
  const key = ip || "unknown";
  const now = Date.now();
  let bucket = forgotRateByIp.get(key);
  if (!bucket || now - bucket.start > FORGOT_RATE_WINDOW_MS) {
    bucket = { start: now, count: 0 };
    forgotRateByIp.set(key, bucket);
  }
  bucket.count += 1;
  return bucket.count <= FORGOT_RATE_MAX;
}

function verifyTokenExpiryDate() {
  return new Date(Date.now() + VERIFY_TOKEN_TTL_MS);
}

/** Normalize tokens from URLs / email clients (whitespace, encoding, stray punctuation). */
function collectVerifyTokenCandidates(raw) {
  const seen = new Set();
  const add = (s) => {
    if (s == null || typeof s !== "string") return;
    const t = s.trim().replace(/\s+/g, "");
    if (t) seen.add(t);
  };
  const s0 = String(raw ?? "")
    .trim()
    .replace(/\s+/g, "");
  add(s0);
  try {
    add(decodeURIComponent(s0));
  } catch {
    /* malformed % sequence — keep s0 only */
  }
  const m = s0.match(/[0-9a-fA-F]{64}/);
  if (m) add(m[0].toLowerCase());
  return [...seen];
}

async function findUserByVerifyToken(rawParam) {
  const candidates = collectVerifyTokenCandidates(rawParam);
  for (const c of candidates) {
    const user = await User.findOne({
      where: where(fn("lower", col("verifyToken")), c.toLowerCase()),
    });
    if (user) return user;
  }
  return null;
}

async function findUserByResetToken(rawParam) {
  const candidates = collectVerifyTokenCandidates(rawParam);
  for (const c of candidates) {
    const user = await User.findOne({
      where: where(fn("lower", col("resetToken")), c.toLowerCase()),
    });
    if (user) return user;
  }
  return null;
}

function resetTokenExpiryDate() {
  return new Date(Date.now() + RESET_TOKEN_TTL_MS);
}

const FORGOT_SUCCESS_MESSAGE =
  "If this email exists, a reset link has been sent.";

function buildRegisterHandler() {
  return async function registerHandler(req, res) {
    console.log("[register] POST /api/register handler invoked");
    try {
      const firstName = (req.body.firstName ?? "").toString().trim();
      const lastName = (req.body.lastName ?? "").toString().trim();
      const password = req.body.password;
      const email = (req.body.email ?? "").toString().trim().toLowerCase();

      if (!firstName || !lastName || !email || password == null || password === "") {
        return res.status(400).json({
          error: "First name, last name, email, and password are required.",
        });
      }

      const existing = await User.findOne({
        where: where(fn("lower", col("email")), email),
      });
      if (existing) {
        return res.status(409).json({ error: "Email already in use" });
      }

      // Added email verification (isVerified + verifyToken + 24h expiry)
      const verifyToken = crypto.randomBytes(32).toString("hex");
      const verifyTokenExpiresAt = verifyTokenExpiryDate();
      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await User.create({
        firstName,
        lastName,
        email,
        password: hashedPassword,
        isVerified: false,
        verifyToken,
        verifyTokenExpiresAt,
      });

      console.log(`[register] verifyTokenExpiresAt=${verifyTokenExpiresAt.toISOString()}`);

      if (!emailDeliveryConfigured()) {
        console.warn(
          "[register] No RESEND_API_KEY or SMTP — auto-verifying user (configure email on Render)"
        );
        user.isVerified = true;
        user.verifyToken = null;
        user.verifyTokenExpiresAt = null;
        await user.save();
        return res.status(201).json({
          ...issueAuthTokenPayload(user),
          message: "Account created. Email verification is disabled until SMTP is configured on the server.",
        });
      }

      try {
        await sendVerificationEmail(email, verifyToken);
        console.log("[register] Verification email sent via SMTP");
        return res.status(201).json({
          message: "Verification email sent",
          requiresVerification: true,
        });
      } catch (mailErr) {
        console.error("[register] Verification email failed:", mailErr?.message ?? mailErr);
        // SMTP misconfigured on Render — still let the user in (fix Gmail App Password later).
        user.isVerified = true;
        user.verifyToken = null;
        user.verifyTokenExpiresAt = null;
        await user.save();
        return res.status(201).json({
          ...issueAuthTokenPayload(user),
          message:
            "Account created. Verification email could not be sent — check SMTP_PASS (Gmail App Password) on Render. You are logged in.",
        });
      }
    } catch (error) {
      console.error("REGISTER ERROR:", error.message, error);
      if (error.name === "SequelizeUniqueConstraintError") {
        return res.status(409).json({ error: "Email already in use" });
      }
      return res.status(500).json({
        error: "Something went wrong. Please try again later.",
      });
    }
  };
}

function buildLoginHandler() {
  return async function loginHandler(req, res) {
    try {
      const password = req.body.password;
      const email = (req.body.email ?? "").toString().trim().toLowerCase();

      if (!email || password == null || password === "") {
        return res.status(400).json({ error: "Email and password required" });
      }

      const user = await User.findOne({
        where: where(fn("lower", col("email")), email),
      });
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password." });
      }

      const ok = await bcrypt.compare(password, user.password);
      if (!ok) {
        return res.status(401).json({ error: "Invalid email or password." });
      }

      // Block login until email is verified (isVerified is false for pending accounts).
      if (!user.isVerified) {
        return res.status(403).json({ error: "Please verify your email first." });
      }

      return res.json(issueAuthTokenPayload(user));
    } catch (err) {
      console.error("LOGIN ERROR:", err.message, err);
      return res.status(500).json({
        error: "Something went wrong. Please try again later.",
      });
    }
  };
}

/** GET /api/auth/verify/:token — activate account and clear verifyToken */
function buildVerifyHandler() {
  return async function verifyHandler(req, res) {
    try {
      const token = (req.params.token ?? "").toString().trim();
      if (!token) {
        return res.status(400).json({ error: "Missing verification token." });
      }

      const tokenLog = token.length > 10 ? `${token.slice(0, 10)}…` : token;

      const user = await findUserByVerifyToken(token);
      if (!user) {
        console.log(`[verify] token=${tokenLog} expired=false userFound=false`);
        return res.status(400).json({ error: "Invalid or expired verification link." });
      }

      const expired =
        user.verifyTokenExpiresAt != null &&
        new Date(user.verifyTokenExpiresAt).getTime() < Date.now();
      console.log(`[verify] token=${tokenLog} expired=${expired} userFound=true`);

      if (expired) {
        return res.status(400).json({
          error: "Verification link expired. Please request a new one.",
        });
      }

      user.isVerified = true;
      user.verifyToken = null;
      user.verifyTokenExpiresAt = null;
      await user.save();

      console.log(`[verify] Account activated email=${user.email} id=${user.id}`);

      return res.json({ message: "Account activated!" });
    } catch (err) {
      console.error("VERIFY ERROR:", err);
      return res.status(500).json({ error: err.message || "Verification failed." });
    }
  };
}

/** POST /api/auth/resend-verification — new token + 24h expiry; generic response if email unknown */
function buildResendVerificationHandler() {
  return async function resendVerificationHandler(req, res) {
    console.log("[resend] POST /api/auth/resend-verification handler invoked");
    try {
      let email = (req.body.email ?? "").toString().trim().toLowerCase();

      if (!email) {
        const authHeader = req.headers.authorization || "";
        const [scheme, bearer] = authHeader.split(" ");
        if (scheme === "Bearer" && bearer) {
          try {
            const decoded = jwt.verify(bearer, JWT_SECRET);
            if (decoded?.email) email = String(decoded.email).trim().toLowerCase();
          } catch {
            /* ignore invalid JWT */
          }
        }
      }

      if (!email) {
        console.log("[resend] email= sent=false reason=missingEmail");
        return res.status(400).json({ error: "Email is required." });
      }

      if (!emailDeliveryConfigured()) {
        console.log(`[resend] email=${email} sent=false reason=smtpNotConfigured`);
        return res.status(503).json({
          error:
            "Email is not configured on the server. Add SMTP_* to backend/.env and restart the backend.",
        });
      }

      const user = await User.findOne({
        where: where(fn("lower", col("email")), email),
      });

      if (!user) {
        console.log(`[resend] email=${email} sent=false reason=notFoundHidden`);
        return res.status(200).json({
          message: "If this email exists, a verification link has been sent.",
        });
      }

      if (user.isVerified) {
        console.log(`[resend] email=${email} sent=false reason=alreadyVerified`);
        return res.status(200).json({ message: "Account is already verified." });
      }

      const verifyToken = crypto.randomBytes(32).toString("hex");
      const verifyTokenExpiresAt = verifyTokenExpiryDate();
      user.verifyToken = verifyToken;
      user.verifyTokenExpiresAt = verifyTokenExpiresAt;
      await user.save();

      let sent = false;
      try {
        await sendVerificationEmail(user.email, verifyToken);
        sent = true;
      } catch (mailErr) {
        console.error("[resend] Verification email failed:", mailErr?.message ?? mailErr);
      }

      console.log(`[resend] email=${email} sent=${sent} reason=resent`);
      if (!sent) {
        return res.status(503).json({
          error: "Could not send verification email. Try again later.",
        });
      }
      return res.status(200).json({ message: "Verification email resent." });
    } catch (err) {
      console.error("RESEND VERIFY ERROR:", err);
      return res.status(500).json({
        error: "Something went wrong. Please try again later.",
      });
    }
  };
}

/** POST /api/auth/forgot-password — always 200 to prevent account enumeration. */
function buildForgotPasswordHandler() {
  return async function forgotPasswordHandler(req, res) {
    try {
      const ip = req.ip || req.socket?.remoteAddress || "unknown";
      if (!forgotRateLimitOk(ip)) {
        // Same body as success so we do not leak rate-limit vs missing user.
        console.log("[forgot] rate-limited ip=", ip);
        return res.status(200).json({ message: FORGOT_SUCCESS_MESSAGE });
      }

      const email = (req.body.email ?? "").toString().trim().toLowerCase();
      if (!email) {
        return res.status(400).json({ error: "Email is required." });
      }

      let issued = false;
      const user = await User.findOne({
        where: where(fn("lower", col("email")), email),
      });

      if (user && emailDeliveryConfigured()) {
        const resetToken = crypto.randomBytes(32).toString("hex");
        user.resetToken = resetToken;
        user.resetTokenExpiresAt = resetTokenExpiryDate();
        await user.save();

        const clientUrl = (process.env.CLIENT_URL || "http://localhost:3000").replace(
          /\/$/,
          ""
        );
        const link = `${clientUrl}/reset/${encodeURIComponent(resetToken)}`;

        try {
          await sendResetEmail({ to: email, link });
          issued = true;
        } catch (mailErr) {
          console.error("[forgot] reset email failed:", mailErr?.message ?? mailErr);
        }
      } else if (user && !emailDeliveryConfigured()) {
        console.warn("[forgot] No RESEND_API_KEY or SMTP — no email sent");
      }

      console.log(`[forgot] email=${email} issued=${issued}`);
      return res.status(200).json({ message: FORGOT_SUCCESS_MESSAGE });
    } catch (err) {
      console.error("FORGOT PASSWORD ERROR:", err);
      return res.status(500).json({
        error: "Something went wrong. Please try again later.",
      });
    }
  };
}

/** POST /api/auth/reset-password — one-time token; clears fields on success. */
function buildResetPasswordHandler() {
  return async function resetPasswordHandler(req, res) {
    try {
      const rawToken = (req.body.token ?? "").toString();
      const newPassword = req.body.newPassword;

      if (!rawToken || newPassword == null || newPassword === "") {
        return res.status(400).json({ error: "Token and new password are required." });
      }

      if (String(newPassword).length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({
          error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
        });
      }

      const user = await findUserByResetToken(rawToken);
      const tokenLog =
        rawToken.length > 10 ? `${String(rawToken).trim().slice(0, 10)}…` : rawToken;

      if (!user) {
        console.log(`[reset] token=${tokenLog} ok=false reason=notFound`);
        return res.status(400).json({ error: "Invalid or expired reset link." });
      }

      const expired =
        user.resetTokenExpiresAt != null &&
        new Date(user.resetTokenExpiresAt).getTime() < Date.now();

      if (expired) {
        console.log(`[reset] token=${tokenLog} ok=false reason=expired`);
        return res.status(400).json({
          error: "Reset link expired. Please request a new one.",
        });
      }

      user.password = await bcrypt.hash(String(newPassword), 10);
      user.resetToken = null;
      user.resetTokenExpiresAt = null;
      // TODO: bump passwordVersion and validate in JWT middleware to invalidate old sessions.
      await user.save();

      console.log(`[reset] token=${tokenLog} ok=true`);
      return res.status(200).json({ message: "Password updated." });
    } catch (err) {
      console.error("RESET PASSWORD ERROR:", err);
      return res.status(500).json({
        error: "Something went wrong. Please try again later.",
      });
    }
  };
}

const registerHandler = buildRegisterHandler();
const loginHandler = buildLoginHandler();
const verifyHandler = buildVerifyHandler();
const resendVerificationHandler = buildResendVerificationHandler();
const forgotPasswordHandler = buildForgotPasswordHandler();
const resetPasswordHandler = buildResetPasswordHandler();

const authRouter = express.Router();
authRouter.get("/verify/:token", verifyHandler);
authRouter.post("/resend-verification", resendVerificationHandler);
authRouter.post("/forgot-password", forgotPasswordHandler);
authRouter.post("/reset-password", resetPasswordHandler);

module.exports = {
  registerHandler,
  loginHandler,
  verifyHandler,
  resendVerificationHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  authRouter,
};
