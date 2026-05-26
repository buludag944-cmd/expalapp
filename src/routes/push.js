const express = require("express");
const DeviceToken = require("../models/DeviceToken");
const { verifyToken } = require("../middleware/auth");
const { pushEnabled } = require("../services/push");

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

/** GET /api/push/status — whether server can send push */
router.get("/status", verifyToken, (_req, res) => {
  res.json({ pushEnabled: pushEnabled() });
});

module.exports = router;
