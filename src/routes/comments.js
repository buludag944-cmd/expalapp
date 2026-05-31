// routes/comments.js — POST creates a comment; GET fetches thread by entity type + id
const express = require("express");
const { Op, fn, col, where } = require("sequelize");
const router = express.Router();
const Comment = require("../models/Comment");
const { THREAD_TYPES } = require("../models/Comment");
const User = require("../models/User");
const Event = require("../models/Event");
const Housing = require("../models/Housing");
const Referral = require("../models/Referral");
const EssentialPost = require("../models/EssentialPost");
const KnowHowPost = require("../models/KnowHowPost");
const { sendPushToUser } = require("../services/push");
const { verifyToken } = require("../middleware/auth");
const { isCommentAuthorOrAdmin } = require("../lib/ownership");

// Keep in sync with Comment model THREAD_TYPES
const ALLOWED_TARGET_TYPES = THREAD_TYPES;

function displayNameFromUserRow(u) {
  if (!u) return null;
  const first = (u.firstName ?? "").toString().trim();
  const last = (u.lastName ?? "").toString().trim();
  const full = `${first} ${last}`.trim();
  return full || null;
}

function commentDeepLinkPath(targetType, targetId) {
  switch (targetType) {
    case "event":
      return "/events";
    case "listing":
      return "/housing";
    case "referral":
      return "/referrals";
    case "essential":
      return `/essentials/${targetId}`;
    case "knowhow":
      return `/knowhow/${targetId}`;
    default:
      return "/";
  }
}

async function getPostOwnerUserId(targetType, targetId) {
  switch (targetType) {
    case "event": {
      const row = await Event.findByPk(targetId, { attributes: ["createdBy"] });
      return row?.createdBy ?? null;
    }
    case "listing": {
      const row = await Housing.findByPk(targetId, { attributes: ["userId"] });
      return row?.userId ?? null;
    }
    case "referral": {
      const row = await Referral.findByPk(targetId, { attributes: ["userId"] });
      return row?.userId ?? null;
    }
    case "essential": {
      const row = await EssentialPost.findByPk(targetId, { attributes: ["createdBy"] });
      return row?.createdBy ?? null;
    }
    case "knowhow": {
      const row = await KnowHowPost.findByPk(targetId, { attributes: ["createdBy"] });
      return row?.createdBy ?? null;
    }
    default:
      return null;
  }
}

async function findUserByEmailLoose(email) {
  if (!email || !String(email).includes("@")) return null;
  return User.findOne({
    where: where(fn("lower", col("email")), String(email).toLowerCase()),
  });
}

/**
 * Ensures each JSON comment has authorName set for the UI (first+last when author matches a User).
 * Legacy rows only stored email in author; this fills the display field without breaking clients.
 */
async function withResolvedAuthorNames(commentInstances) {
  const rows = commentInstances.map((c) => c.get({ plain: true }));
  const emailsToLookup = [
    ...new Set(
      rows
        .filter(
          (r) =>
            !(r.authorName && String(r.authorName).trim()) &&
            r.author &&
            String(r.author).includes("@")
        )
        .map((r) => String(r.author).toLowerCase())
    ),
  ];

  let byLower = new Map();
  if (emailsToLookup.length > 0) {
    const users = await User.findAll({
      attributes: ["firstName", "lastName", "email"],
      where: {
        [Op.or]: emailsToLookup.map((e) => where(fn("lower", col("email")), e)),
      },
    });
    byLower = new Map(users.map((u) => [String(u.email).toLowerCase(), u]));
  }

  return rows.map((r) => {
    const stored = (r.authorName ?? "").toString().trim();
    if (stored) return { ...r, authorName: stored };
    if (r.author && String(r.author).includes("@")) {
      const u = byLower.get(String(r.author).toLowerCase());
      const fromUser = displayNameFromUserRow(u);
      if (fromUser) return { ...r, authorName: fromUser };
      return { ...r, authorName: String(r.author).split("@")[0] || null };
    }
    const fallback = (r.author ?? "").toString().trim();
    return { ...r, authorName: fallback || null };
  });
}

// Explicit field checks → clear 400s for Postman/frontends sending partial bodies
function parseCommentBody(raw) {
  const content = (raw?.content ?? "").toString().trim();
  const author = (raw?.author ?? "").toString().trim();
  const authorNameOpt = (raw?.authorName ?? "").toString().trim();
  let targetType = (raw?.targetType ?? "").toString().trim().toLowerCase();
  const idRaw = raw?.targetId;

  if (!content) {
    return { ok: false, status: 400, error: "Missing content." };
  }
  if (!author) {
    return { ok: false, status: 400, error: "Missing author." };
  }
  if (!targetType) {
    return { ok: false, status: 400, error: "Missing targetType." };
  }
  if (!ALLOWED_TARGET_TYPES.includes(targetType)) {
    return {
      ok: false,
      status: 400,
      error:
        "Invalid targetType. Use event, listing, referral, essential, or knowhow.",
    };
  }
  if (idRaw == null || idRaw === "") {
    return { ok: false, status: 400, error: "Missing targetId." };
  }

  const idNum = Number(idRaw);
  if (!Number.isInteger(idNum) || idNum < 1) {
    return {
      ok: false,
      status: 400,
      error: "targetId must be a positive integer.",
    };
  }

  const payload = { content, author, targetType, targetId: idNum };
  // authorName is what the client renders as the commenter label (not the email string)
  if (authorNameOpt) {
    payload.authorName = authorNameOpt;
  }

  return { ok: true, payload };
}

// POST body: content, author (email), authorName (display — optional client/server resolved), targetType, targetId
router.post("/", async (req, res) => {
  // Debug: confirms express.json mounted before this router and shows real payload shape
  console.log("[comments POST] req.body =", req.body);

  const parsed = parseCommentBody(req.body);
  if (!parsed.ok) {
    return res.status(parsed.status).json({ error: parsed.error });
  }

  try {
    let payload = { ...parsed.payload };
    if (!payload.authorName) {
      const u = await findUserByEmailLoose(payload.author);
      const dn = displayNameFromUserRow(u);
      if (dn) payload = { ...payload, authorName: dn };
    }
    const comment = await Comment.create(payload);
    const [out] = await withResolvedAuthorNames([comment]);

    const ownerId = await getPostOwnerUserId(payload.targetType, payload.targetId);
    if (ownerId) {
      const commenter = await findUserByEmailLoose(payload.author);
      if (!commenter || commenter.id !== ownerId) {
        const commenterLabel =
          (payload.authorName || displayNameFromUserRow(commenter) || "Someone")
            .toString()
            .trim() || "Someone";
        const preview = payload.content.slice(0, 100);
        sendPushToUser(ownerId, {
          title: "New comment on your post",
          body: `${commenterLabel}: ${preview}`,
          data: {
            type: "comment",
            targetType: payload.targetType,
            targetId: String(payload.targetId),
            path: commentDeepLinkPath(payload.targetType, payload.targetId),
          },
        }).catch((err) =>
          console.error("[push] comment notify:", err.message || err)
        );
      }
    }

    return res.status(201).json(out);
  } catch (err) {
    console.error("COMMENT CREATE ERROR:", err?.message ?? err);
    console.error(err);
    // Sequelize model validation → 400 with readable message (not buried in 500)
    if (err.name === "SequelizeValidationError") {
      const msg =
        err.errors?.map((e) => e.message).join("; ") ||
        "Validation failed.";
      return res.status(400).json({ error: msg });
    }
    // Bad enum / constraint from DB still surfaced as operational error
    return res.status(500).json({
      error:
        "Server error creating comment. If this persists, check DB schema sync for Comments.",
    });
  }
});

// GET comments for a specific thread (event | listing | referral | essential | knowhow)
router.get("/:targetType/:targetId", async (req, res) => {
  const targetType = (req.params.targetType ?? "").toString().trim().toLowerCase();
  if (!ALLOWED_TARGET_TYPES.includes(targetType)) {
    return res.status(400).json({
      error:
        "Invalid targetType. Use event, listing, referral, essential, or knowhow.",
    });
  }

  const idNum = Number(req.params.targetId);
  if (!Number.isInteger(idNum) || idNum < 1) {
    return res.status(400).json({
      error: "targetId must be a positive integer.",
    });
  }

  try {
    const comments = await Comment.findAll({
      where: { targetType, targetId: idNum },
      order: [["createdAt", "ASC"]],
    });
    const out = await withResolvedAuthorNames(comments);
    return res.status(200).json(out);
  } catch (err) {
    console.error("FETCH COMMENTS ERROR:", err?.message ?? err);
    return res.status(500).json({ error: "Failed to fetch comments." });
  }
});

router.patch("/:id", verifyToken, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Invalid comment id." });
  }

  try {
    const comment = await Comment.findByPk(id);
    if (!comment) return res.status(404).json({ error: "Comment not found." });
    if (!isCommentAuthorOrAdmin(req.user, comment)) {
      return res.status(403).json({ error: "You can only edit your own comments." });
    }
    const content = (req.body?.content ?? "").toString().trim();
    if (!content) return res.status(400).json({ error: "Missing content." });
    await comment.update({ content });
    const [out] = await withResolvedAuthorNames([comment]);
    return res.json(out);
  } catch (err) {
    console.error("COMMENT UPDATE ERROR:", err?.message ?? err);
    return res.status(500).json({ error: "Failed to update comment." });
  }
});

router.delete("/:id", verifyToken, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Invalid comment id." });
  }

  try {
    const comment = await Comment.findByPk(id);
    if (!comment) return res.status(404).json({ error: "Comment not found." });
    if (!isCommentAuthorOrAdmin(req.user, comment)) {
      return res.status(403).json({ error: "You can only delete your own comments." });
    }
    await comment.destroy();
    return res.status(204).send();
  } catch (err) {
    console.error("COMMENT DELETE ERROR:", err?.message ?? err);
    return res.status(500).json({ error: "Failed to delete comment." });
  }
});

module.exports = router;
