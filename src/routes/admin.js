/**
 * Admin routes — server-enforced; JWT isAdmin is UI-only.
 *
 * Runbook (after migrate:add-is-admin):
 *   1. Log in → Bearer token
 *   2. POST /api/admin/promote { "email": "you@example.com" }  (bootstrap if zero admins)
 *   3. DELETE /api/admin/users  (admins only; never deletes isAdmin=true)
 *
 * TODO: persist audit log table; finer-grained purge; rate limits for UI exposure.
 */
const express = require("express");
const { Op, fn, col, where } = require("sequelize");
const {
  sequelize,
  User,
  Housing,
  Referral,
  Message,
  Event,
  EssentialPost,
  KnowHowPost,
  Comment,
} = require("../bootstrapModels");
const { requireAdmin, requireAdminOrBootstrap } = require("../middleware/requireAdmin");

const router = express.Router();

/** POST /api/admin/promote — set isAdmin=true for one user. */
router.post("/promote", requireAdminOrBootstrap, async (req, res) => {
  try {
    const email = (req.body.email ?? "").toString().trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const user = await User.findOne({
      where: where(fn("lower", col("email")), email),
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const actorId = req.user?.id;
    const bootstrap = (await User.count({ where: { isAdmin: true } })) === 0;

    user.isAdmin = true;
    await user.save();

    console.log(
      `[admin] promote target=${email} actor=${actorId} bootstrap=${bootstrap} at=${new Date().toISOString()}`
    );

    return res.status(200).json({
      message: "Promoted to admin.",
      userId: user.id,
      email: user.email,
    });
  } catch (err) {
    console.error("[admin] promote error:", err.message || err);
    return res.status(500).json({ error: "Promote failed." });
  }
});

/** DELETE /api/admin/users — remove all non-admin users and their content. */
router.delete("/users", requireAdmin, async (req, res) => {
  const actorId = req.user?.id;
  const started = Date.now();

  try {
    const nonAdmins = await User.findAll({
      where: { isAdmin: false },
      attributes: ["id", "email"],
    });

    if (nonAdmins.length === 0) {
      console.log(
        `[admin] purge actor=${actorId} deleted=0 at=${new Date().toISOString()}`
      );
      return res.status(200).json({
        deletedUsers: 0,
        counts: {},
        message: "No non-admin users to delete.",
      });
    }

    const ids = nonAdmins.map((u) => u.id);
    const emails = nonAdmins.map((u) => (u.email || "").toLowerCase()).filter(Boolean);

    const counts = await sequelize.transaction(async (t) => {
      const opts = { transaction: t };

      const comments = await Comment.destroy({
        where: {
          [Op.or]: emails.map((em) =>
            where(fn("lower", col("author")), em)
          ),
        },
        ...opts,
      });

      const messages = await Message.destroy({
        where: {
          [Op.or]: [{ senderId: { [Op.in]: ids } }, { receiverId: { [Op.in]: ids } }],
        },
        ...opts,
      });

      const housing = await Housing.destroy({
        where: { userId: { [Op.in]: ids } },
        ...opts,
      });

      const referrals = await Referral.destroy({
        where: { userId: { [Op.in]: ids } },
        ...opts,
      });

      const events = await Event.destroy({
        where: { createdBy: { [Op.in]: ids } },
        ...opts,
      });

      const essentials = await EssentialPost.destroy({
        where: { createdBy: { [Op.in]: ids } },
        ...opts,
      });

      const knowhow = await KnowHowPost.destroy({
        where: { createdBy: { [Op.in]: ids } },
        ...opts,
      });

      const deletedUsers = await User.destroy({
        where: { id: { [Op.in]: ids }, isAdmin: false },
        ...opts,
      });

      return {
        comments,
        messages,
        housing,
        referrals,
        events,
        essentials,
        knowhow,
        deletedUsers,
      };
    });

    console.log(
      `[admin] purge actor=${actorId} deleted=${counts.deletedUsers} counts=${JSON.stringify(counts)} ms=${Date.now() - started} at=${new Date().toISOString()}`
    );

    return res.status(200).json({
      deletedUsers: counts.deletedUsers,
      counts: {
        comments: counts.comments,
        messages: counts.messages,
        housing: counts.housing,
        referrals: counts.referrals,
        events: counts.events,
        essentials: counts.essentials,
        knowhow: counts.knowhow,
      },
    });
  } catch (err) {
    console.error("[admin] purge error:", err.message || err);
    return res.status(500).json({ error: "Purge failed." });
  }
});

module.exports = router;
