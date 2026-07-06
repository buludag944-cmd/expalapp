const { Op } = require("sequelize");
const { sendPushToUser } = require("../services/push");

function displayName(user) {
  if (!user) return "Someone";
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return full || user.email || "Someone";
}

function commentNotifyMeta(targetType) {
  switch (targetType) {
    case "listing":
      return { title: "New enquiry on your listing", kind: "housing" };
    case "event":
      return { title: "New comment on your event", kind: "event" };
    case "referral":
      return { title: "New enquiry on your referral", kind: "referral" };
    case "essential":
      return { title: "New comment on your post", kind: "essential" };
    case "knowhow":
      return { title: "New comment on your guide", kind: "knowhow" };
    default:
      return { title: "New comment on your post", kind: "comment" };
  }
}

function notifyUserSafe(userId, payload) {
  if (!userId) return Promise.resolve();
  return sendPushToUser(Number(userId), payload).catch((err) => {
    console.error("[push] notify failed:", err.message || err);
  });
}

async function notifyUsersSafe(userIds, payload) {
  const unique = [...new Set(userIds.map(Number).filter((id) => id > 0))];
  await Promise.all(unique.map((id) => notifyUserSafe(id, payload)));
}

async function notifyForumThreadReply({ thread, replyAuthorId, replyAuthor, body, ForumReply }) {
  const replierName = displayName(replyAuthor);
  const preview = body.slice(0, 120);
  const path = `/community/thread/${thread.id}`;
  const base = {
    title: "New reply on a thread",
    body: `${replierName}: ${preview}`,
    data: {
      type: "forum_thread",
      threadId: String(thread.id),
      path,
    },
  };

  const notifyIds = new Set();

  if (thread.authorId && thread.authorId !== replyAuthorId) {
    notifyIds.add(thread.authorId);
  }

  const previous = await ForumReply.findAll({
    where: {
      threadId: thread.id,
      authorId: { [Op.ne]: replyAuthorId },
    },
    attributes: ["authorId"],
  });
  for (const row of previous) {
    if (row.authorId && row.authorId !== replyAuthorId) {
      notifyIds.add(row.authorId);
    }
  }

  await notifyUsersSafe([...notifyIds], base);
}

async function notifyForumNewThread({ thread, author, spaceName, ForumSubscription }) {
  const authorName = displayName(author);
  const preview = thread.title.slice(0, 80);
  const path = `/community/thread/${thread.id}`;
  const payload = {
    title: spaceName ? `New thread in ${spaceName}` : "New community thread",
    body: `${authorName}: ${preview}`,
    data: {
      type: "forum_thread",
      threadId: String(thread.id),
      path,
    },
  };

  const subs = await ForumSubscription.findAll({
    where: { spaceId: thread.spaceId },
    attributes: ["userId"],
  });
  const ids = subs.map((s) => s.userId).filter((id) => id && id !== author.id);
  await notifyUsersSafe(ids, payload);
}

module.exports = {
  displayName,
  commentNotifyMeta,
  notifyUserSafe,
  notifyUsersSafe,
  notifyForumThreadReply,
  notifyForumNewThread,
};
