/**
 * Permanently delete one user and their associated content.
 * Used by self-service DELETE /api/profile.
 */
const { Op, fn, col, where } = require("sequelize");
const models = require("../bootstrapModels");
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
  DeviceToken,
  TimelineTask,
  ForumThread,
  ForumReply,
  ForumSubscription,
  MentorMatch,
  ResidencyRecord,
  AbsenceLog,
  Document,
  LifeAbroadScore,
  FeatureEvent,
  Notification,
} = models;

async function deleteUserAccount(userId) {
  const user = await User.findByPk(userId, { attributes: ["id", "email"] });
  if (!user) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }

  const id = user.id;
  const email = (user.email || "").toLowerCase();

  await sequelize.transaction(async (t) => {
    const opts = { transaction: t };

    if (email) {
      await Comment.destroy({
        where: where(fn("lower", col("author")), email),
        ...opts,
      });
    }

    await Message.destroy({
      where: {
        [Op.or]: [{ senderId: id }, { receiverId: id }],
      },
      ...opts,
    });

    await Housing.destroy({ where: { userId: id }, ...opts });
    await Referral.destroy({ where: { userId: id }, ...opts });
    await Event.destroy({ where: { createdBy: id }, ...opts });
    await EssentialPost.destroy({ where: { createdBy: id }, ...opts });
    await KnowHowPost.destroy({ where: { createdBy: id }, ...opts });
    if (models.BlogPost) {
      await models.BlogPost.destroy({ where: { authorId: id }, ...opts });
    }

    const threads = await ForumThread.findAll({
      where: { authorId: id },
      attributes: ["id"],
      ...opts,
    });
    const threadIds = threads.map((row) => row.id);
    if (threadIds.length) {
      await ForumReply.destroy({ where: { threadId: { [Op.in]: threadIds } }, ...opts });
      await ForumThread.destroy({ where: { id: { [Op.in]: threadIds } }, ...opts });
    }
    await ForumReply.destroy({ where: { authorId: id }, ...opts });
    await ForumSubscription.destroy({ where: { userId: id }, ...opts });

    await MentorMatch.destroy({
      where: {
        [Op.or]: [{ mentorId: id }, { menteeId: id }],
      },
      ...opts,
    });

    await AbsenceLog.destroy({ where: { userId: id }, ...opts });
    await ResidencyRecord.destroy({ where: { userId: id }, ...opts });
    await Document.destroy({ where: { userId: id }, ...opts });
    await LifeAbroadScore.destroy({ where: { userId: id }, ...opts });
    await FeatureEvent.destroy({ where: { userId: id }, ...opts });
    await TimelineTask.destroy({ where: { userId: id }, ...opts });
    await DeviceToken.destroy({ where: { userId: id }, ...opts });
    await Notification.destroy({
      where: {
        [Op.or]: [{ userId: id }, { actorId: id }],
      },
      ...opts,
    });

    await User.destroy({ where: { id }, ...opts });
  });

  return { id, email };
}

module.exports = { deleteUserAccount };
