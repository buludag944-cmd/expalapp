const express = require("express");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { User, ForumThread, ForumSpace } = require("../bootstrapModels");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

const MEMBER_ATTRS = [
  "id",
  "firstName",
  "lastName",
  "nationality",
  "currentCity",
  "company",
  "industry",
  "bio",
  "interests",
  "profileImage",
];

function likeOp() {
  return sequelize.getDialect() === "postgres" ? Op.iLike : Op.like;
}

/** GET /api/search?q= — members + community threads */
router.get("/", verifyToken, async (req, res) => {
  try {
    const raw = String(req.query.q || "").trim();
    if (!raw) {
      return res.json({ members: [], threads: [], query: "" });
    }
    const pattern = `%${raw}%`;
    const like = likeOp();

    const members = await User.findAll({
      where: {
        [Op.or]: [
          { firstName: { [like]: pattern } },
          { lastName: { [like]: pattern } },
          { nationality: { [like]: pattern } },
          { currentCity: { [like]: pattern } },
          { industry: { [like]: pattern } },
          { company: { [like]: pattern } },
          { bio: { [like]: pattern } },
        ],
      },
      attributes: MEMBER_ATTRS,
      order: [["firstName", "ASC"], ["lastName", "ASC"]],
      limit: 25,
    });

    const threads = await ForumThread.findAll({
      where: {
        [Op.or]: [{ title: { [like]: pattern } }, { body: { [like]: pattern } }],
      },
      include: [
        { model: User, as: "Author", attributes: ["id", "firstName", "lastName", "profileImage"] },
        { model: ForumSpace, attributes: ["id", "name"] },
      ],
      order: [["lastActivityAt", "DESC"]],
      limit: 25,
    });

    res.json({
      query: raw,
      members,
      threads: threads.map((t) => {
        const row = t.toJSON();
        return {
          id: row.id,
          spaceId: row.spaceId,
          title: row.title,
          body: row.body,
          replyCount: row.replyCount,
          lastActivityAt: row.lastActivityAt,
          author: row.Author,
          spaceName: row.ForumSpace?.name || null,
        };
      }),
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Search failed" });
  }
});

module.exports = router;
