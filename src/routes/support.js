const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const { User, Message } = require("../bootstrapModels");
const { createAndPushNotification } = require("../lib/pushNotify");
const { sendSupportContactEmail, emailDeliveryConfigured } = require("../services/email");

async function resolveFounderUser() {
  const envId = Number(process.env.FOUNDER_USER_ID);
  if (envId > 0) {
    const byId = await User.findByPk(envId);
    if (byId) return byId;
  }
  const admin = await User.findOne({
    where: { isAdmin: true },
    order: [["id", "ASC"]],
  });
  if (admin) return admin;
  const email = (process.env.FOUNDER_EMAIL || process.env.SUPPORT_EMAIL || "expalappsupport@gmail.com")
    .trim()
    .toLowerCase();
  if (email) {
    const byEmail = await User.findOne({ where: { email } });
    if (byEmail) return byEmail;
  }
  return null;
}

/**
 * POST /api/support/contact
 * Every authenticated member can message the founder.
 * Delivers: DM (if founder account exists) + in-app notification + email (if configured).
 */
router.post("/contact", verifyToken, async (req, res) => {
  try {
    const content = String(req.body?.message || req.body?.content || "").trim();
    if (!content || content.length < 5) {
      return res.status(400).json({ error: "Please write a short message (at least 5 characters)." });
    }
    if (content.length > 4000) {
      return res.status(400).json({ error: "Message is too long (max 4000 characters)." });
    }

    const sender = await User.findByPk(req.user.id);
    if (!sender) return res.status(401).json({ error: "User not found" });

    const senderName =
      [sender.firstName, sender.lastName].filter(Boolean).join(" ").trim() || sender.email || "Member";
    const founder = await resolveFounderUser();

    let messageRow = null;
    if (founder && Number(founder.id) !== Number(sender.id)) {
      messageRow = await Message.create({
        senderId: sender.id,
        receiverId: founder.id,
        content: `[Contact Founder]\n${content}`,
      });
      await createAndPushNotification(founder.id, {
        title: "Contact Founder message",
        body: `${senderName}: ${content.slice(0, 120)}`,
        type: "contact_founder",
        actorId: sender.id,
        data: {
          type: "message",
          peerId: String(sender.id),
          path: `/messages?user=${sender.id}`,
        },
      });
    }

    const supportTo =
      (process.env.SUPPORT_EMAIL || process.env.FOUNDER_EMAIL || "expalappsupport@gmail.com").trim();
    let emailed = false;
    if (emailDeliveryConfigured() && supportTo) {
      try {
        await sendSupportContactEmail({
          to: supportTo,
          fromMember: {
            id: sender.id,
            name: senderName,
            email: sender.email,
          },
          message: content,
        });
        emailed = true;
      } catch (err) {
        console.error("[support] email failed:", err.message || err);
      }
    }

    if (!messageRow && !emailed) {
      return res.status(503).json({
        error:
          "Could not deliver your message right now. Email support at expalappsupport@gmail.com, or try again later.",
      });
    }

    res.status(201).json({
      ok: true,
      deliveredVia: {
        dm: !!messageRow,
        email: emailed,
      },
      messageId: messageRow?.id || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
