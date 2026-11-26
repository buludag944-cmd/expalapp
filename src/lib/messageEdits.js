const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const DELETED_TEXT = "This message was deleted";

function result(status, body) {
  return { status, body };
}

async function loadOwnMessage(Message, userId, messageId) {
  const id = Number(messageId);
  if (!Number.isFinite(id) || id <= 0) return result(400, { error: "Invalid message" });
  const message = await Message.findByPk(id);
  if (!message || Number(message.senderId) !== Number(userId)) {
    return result(404, { error: "Message not found" });
  }
  return { message };
}

async function editOwnMessage(Message, { userId, messageId, content, now = new Date() }) {
  const loaded = await loadOwnMessage(Message, userId, messageId);
  if (!loaded.message) return loaded;
  const message = loaded.message;
  if (message.deletedAt) return result(400, { error: "This message was deleted" });
  const next = String(content || "").trim();
  if (!next) return result(400, { error: "Message cannot be empty" });
  if (next.length > 5000) return result(400, { error: "Message is too long" });
  const created = new Date(message.createdAt).getTime();
  if (now.getTime() - created > EDIT_WINDOW_MS) {
    return result(400, { error: "Messages can only be edited within 24 hours" });
  }
  message.content = next;
  message.editedAt = now;
  await message.save();
  return result(200, message.toJSON());
}

async function deleteOwnMessage(Message, { userId, messageId, now = new Date() }) {
  const loaded = await loadOwnMessage(Message, userId, messageId);
  if (!loaded.message) return loaded;
  const message = loaded.message;
  if (!message.deletedAt) {
    message.content = DELETED_TEXT;
    message.deletedAt = now;
    await message.save();
  }
  return result(200, { id: message.id, deletedAt: message.deletedAt });
}

module.exports = { EDIT_WINDOW_MS, DELETED_TEXT, editOwnMessage, deleteOwnMessage };
