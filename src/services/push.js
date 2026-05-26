/**
 * Firebase Cloud Messaging (FCM) — works from Render over HTTPS.
 * Set FIREBASE_SERVICE_ACCOUNT_JSON on Render (full service account JSON, one line).
 */
const DeviceToken = require("../models/DeviceToken");

let firebaseAdmin = null;
let initAttempted = false;

function pushEnabled() {
  return !!(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
}

function getMessaging() {
  if (!pushEnabled()) return null;
  if (firebaseAdmin) return firebaseAdmin.messaging();

  if (!initAttempted) {
    initAttempted = true;
    try {
      const admin = require("firebase-admin");
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON.trim();
      const serviceAccount = JSON.parse(raw);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      firebaseAdmin = admin;
      console.log("[push] Firebase Admin initialized");
    } catch (err) {
      console.error("[push] Firebase init failed:", err.message || err);
      firebaseAdmin = null;
    }
  }

  return firebaseAdmin ? firebaseAdmin.messaging() : null;
}

/**
 * Send notification to all devices registered for a user.
 */
async function sendPushToUser(userId, { title, body, data = {} }) {
  const messaging = getMessaging();
  if (!messaging) return { sent: 0, skipped: "push_not_configured" };

  const rows = await DeviceToken.findAll({
    where: { userId: Number(userId) },
    attributes: ["fcmToken"],
  });
  const tokens = rows.map((r) => r.fcmToken).filter(Boolean);
  if (!tokens.length) return { sent: 0, skipped: "no_tokens" };

  const dataPayload = {};
  for (const [k, v] of Object.entries(data)) {
    if (v != null) dataPayload[String(k)] = String(v);
  }

  try {
    const result = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: dataPayload,
      android: { priority: "high" },
    });

    const stale = [];
    result.responses.forEach((resp, i) => {
      if (!resp.success) {
        const code = resp.error && resp.error.code;
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          stale.push(tokens[i]);
        }
      }
    });
    if (stale.length) {
      await DeviceToken.destroy({ where: { fcmToken: stale } });
      console.log("[push] removed stale tokens:", stale.length);
    }

    console.log(
      `[push] sent to userId=${userId} success=${result.successCount} failure=${result.failureCount}`
    );
    return { sent: result.successCount, failure: result.failureCount };
  } catch (err) {
    console.error("[push] send failed:", err.message || err);
    return { sent: 0, error: err.message };
  }
}

module.exports = { pushEnabled, sendPushToUser, getMessaging };
