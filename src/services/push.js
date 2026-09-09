/**
 * Firebase Cloud Messaging (FCM) — works from Render over HTTPS.
 * Android: FCM direct. iOS: FCM → APNs (requires APNs Auth Key .p8 in Firebase Console).
 * Set FIREBASE_SERVICE_ACCOUNT_JSON on Render (full service account JSON, one line).
 */
const DeviceToken = require("../models/DeviceToken");
const { isConfigured, getAdmin } = require("./firebaseAdmin");

const ANDROID_CHANNEL_ID = "expal_default";

function pushEnabled() {
  return isConfigured();
}

function getMessaging() {
  const admin = getAdmin();
  return admin ? admin.messaging() : null;
}

function hintForFcmCode(code) {
  if (!code) return null;
  if (
    code === "messaging/third-party-auth-error" ||
    code === "messaging/third-party-auth-error-with-apns"
  ) {
    return "Firebase cannot authenticate with APNs. Upload an APNs Authentication Key (.p8) under Firebase → Project settings → Cloud Messaging → Apple app (com.yourbrand.expal). Key covers sandbox + production.";
  }
  if (code === "messaging/registration-token-not-registered") {
    return "Stale FCM token — open the iOS app, Profile → Enable push alerts, then try again.";
  }
  if (code === "messaging/invalid-argument") {
    return "Invalid FCM payload or token.";
  }
  if (code === "messaging/mismatched-credential") {
    return "FIREBASE_SERVICE_ACCOUNT_JSON is for a different Firebase project than the iOS app.";
  }
  return null;
}

/**
 * Send notification to all devices registered for a user.
 * Explicit APNs `alert` is required for reliable lock-screen / tray display on iOS.
 */
async function sendPushToUser(userId, { title, body, data = {} }) {
  const messaging = getMessaging();
  if (!messaging) return { sent: 0, skipped: "push_not_configured" };

  const rows = await DeviceToken.findAll({
    where: { userId: Number(userId) },
    attributes: ["fcmToken", "platform"],
  });
  const tokens = rows.map((r) => r.fcmToken).filter(Boolean);
  if (!tokens.length) return { sent: 0, skipped: "no_tokens" };

  const safeTitle = String(title || "EXPal").slice(0, 120);
  const safeBody = String(body || "").slice(0, 500);

  const dataPayload = {};
  for (const [k, v] of Object.entries(data)) {
    if (v != null) dataPayload[String(k)] = String(v);
  }

  try {
    const result = await messaging.sendEachForMulticast({
      tokens,
      notification: { title: safeTitle, body: safeBody },
      data: dataPayload,
      android: {
        priority: "high",
        notification: {
          channelId: ANDROID_CHANNEL_ID,
          sound: "default",
          defaultVibrateTimings: true,
          notificationCount: 1,
        },
      },
      apns: {
        headers: {
          "apns-priority": "10",
          "apns-push-type": "alert",
        },
        payload: {
          aps: {
            alert: {
              title: safeTitle,
              body: safeBody,
            },
            sound: "default",
            badge: 1,
            "interruption-level": "active",
          },
        },
      },
    });

    const stale = [];
    const errors = [];
    result.responses.forEach((resp, i) => {
      if (!resp.success) {
        const code = resp.error && resp.error.code;
        const message = resp.error && resp.error.message;
        errors.push({
          platform: rows[i] && rows[i].platform,
          code: code || "unknown",
          message: message || String(resp.error || "send failed"),
          hint: hintForFcmCode(code),
        });
        console.error(
          `[push] token failure userId=${userId} platform=${rows[i] && rows[i].platform} code=${code} msg=${message}`
        );
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
    return {
      sent: result.successCount,
      failure: result.failureCount,
      errors,
      devices: rows.map((r) => ({ platform: r.platform })),
    };
  } catch (err) {
    console.error("[push] send failed:", err.message || err);
    return { sent: 0, error: err.message, errors: [{ code: "exception", message: err.message }] };
  }
}

module.exports = { pushEnabled, sendPushToUser, getMessaging, hintForFcmCode };
