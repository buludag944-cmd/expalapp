const express = require("express");
const DeviceToken = require("../models/DeviceToken");
const { verifyToken } = require("../middleware/auth");
const { pushEnabled, sendPushToUser, hintForFcmCode } = require("../services/push");

const router = express.Router();

/** POST /api/push/register — save FCM device token for logged-in user */
router.post("/register", verifyToken, async (req, res) => {
  try {
    const fcmToken = (req.body.token || req.body.fcmToken || "").toString().trim();
    const platform = (req.body.platform || "unknown").toString().trim().slice(0, 32);

    if (!fcmToken) {
      return res.status(400).json({ error: "token is required" });
    }

    const existing = await DeviceToken.findOne({ where: { fcmToken } });
    if (existing) {
      existing.userId = req.user.id;
      existing.platform = platform;
      await existing.save();
    } else {
      await DeviceToken.create({
        userId: req.user.id,
        fcmToken,
        platform,
      });
    }

    console.log(`[push] registered userId=${req.user.id} platform=${platform}`);
    return res.status(200).json({
      ok: true,
      pushEnabled: pushEnabled(),
    });
  } catch (err) {
    console.error("[push] register error:", err.message || err);
    return res.status(500).json({ error: "Could not register device for push." });
  }
});

/** DELETE /api/push/unregister — remove token on logout */
router.delete("/unregister", verifyToken, async (req, res) => {
  try {
    const fcmToken = (req.body.token || req.body.fcmToken || "").toString().trim();
    if (fcmToken) {
      await DeviceToken.destroy({ where: { fcmToken, userId: req.user.id } });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/** GET /api/push/status — whether server can send push + device count for this user */
router.get("/status", verifyToken, async (req, res) => {
  try {
    const count = await DeviceToken.count({ where: { userId: req.user.id } });
    const rows = await DeviceToken.findAll({
      where: { userId: req.user.id },
      attributes: ["platform", "updatedAt"],
      order: [["updatedAt", "DESC"]],
      limit: 5,
    });
    res.json({
      pushEnabled: pushEnabled(),
      deviceCount: count,
      devices: rows.map((r) => ({
        platform: r.platform,
        updatedAt: r.updatedAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/push/test — send a lock-screen test notification to this user's devices.
 * Returns FCM success/failure codes so APNs misconfiguration is visible in the app.
 */
router.post("/test", verifyToken, async (req, res) => {
  try {
    if (!pushEnabled()) {
      return res.status(503).json({
        ok: false,
        error: "Push is not configured on the server (FIREBASE_SERVICE_ACCOUNT_JSON).",
      });
    }

    const result = await sendPushToUser(req.user.id, {
      title: "EXPal push test",
      body: "If you see this on the lock screen, iOS push is working.",
      data: { type: "push_test", path: "/profile" },
    });

    if (result.skipped === "no_tokens") {
      return res.status(400).json({
        ok: false,
        error: "No device token registered. Open Profile → Enable push alerts first.",
        ...result,
      });
    }

    const firstError = Array.isArray(result.errors) && result.errors[0];
    const hint =
      (firstError && firstError.hint) ||
      hintForFcmCode(firstError && firstError.code) ||
      null;

    return res.status(200).json({
      ok: result.sent > 0,
      sent: result.sent || 0,
      failure: result.failure || 0,
      errors: result.errors || [],
      hint,
      message:
        result.sent > 0
          ? "Test push sent. Lock the phone — you should see it within a few seconds."
          : hint ||
            (firstError && firstError.message) ||
            result.error ||
            "Push send failed.",
    });
  } catch (err) {
    console.error("[push] test error:", err.message || err);
    return res.status(500).json({ ok: false, error: err.message || "Test push failed" });
  }
});

module.exports = router;
