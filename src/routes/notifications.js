const express = require("express");
const router = express.Router();
const { Op } = require("sequelize");
const { verifyToken } = require("../middleware/auth");
const Notification = require("../models/Notification");
const User = require("../models/User");

function parseData(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function serialize(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    ...plain,
    data: parseData(plain.data),
    Actor: plain.Actor
      ? {
          id: plain.Actor.id,
          firstName: plain.Actor.firstName,
          lastName: plain.Actor.lastName,
          profileImage: plain.Actor.profileImage,
        }
      : null,
  };
}

router.get("/", verifyToken, async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 40));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const rows = await Notification.findAll({
      where: { userId: req.user.id },
      include: [
        {
          model: User,
          as: "Actor",
          attributes: ["id", "firstName", "lastName", "profileImage"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });
    res.json(rows.map(serialize));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/unread-count", verifyToken, async (req, res) => {
  try {
    const count = await Notification.count({
      where: { userId: req.user.id, isRead: false },
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id/read", verifyToken, async (req, res) => {
  try {
    const row = await Notification.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!row) return res.status(404).json({ error: "Notification not found" });
    if (!row.isRead) {
      await row.update({ isRead: true, readAt: new Date() });
    }
    res.json(serialize(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/read-all", verifyToken, async (req, res) => {
  try {
    const [updated] = await Notification.update(
      { isRead: true, readAt: new Date() },
      { where: { userId: req.user.id, isRead: false } }
    );
    res.json({ updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Mark message notifications from a peer as read (when opening a DM thread). */
router.post("/read-messages", verifyToken, async (req, res) => {
  try {
    const peerId = Number(req.body?.peerId);
    if (!peerId) return res.status(400).json({ error: "peerId required" });
    const rows = await Notification.findAll({
      where: {
        userId: req.user.id,
        isRead: false,
        type: "message",
      },
    });
    let updated = 0;
    for (const row of rows) {
      const data = parseData(row.data);
      if (String(data.peerId) === String(peerId) || String(row.actorId) === String(peerId)) {
        await row.update({ isRead: true, readAt: new Date() });
        updated += 1;
      }
    }
    res.json({ updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
