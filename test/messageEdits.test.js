const path = require("path");

process.env.DATABASE_PATH = path.join(__dirname, "message-edits-test.db");
delete process.env.DATABASE_URL;
process.env.JWT_SECRET = "test-jwt-secret";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const sequelize = require("../src/config/database");
const { User, Message } = require("../src/bootstrapModels");
const { editOwnMessage, deleteOwnMessage } = require("../src/lib/messageEdits");

before(async () => {
  await User.sync({ force: true });
  await Message.sync({ force: true });
  await User.create({
    id: 1,
    firstName: "Ada",
    lastName: "Example",
    email: "ada@example.com",
    password: "hashed",
  });
  await User.create({
    id: 2,
    firstName: "Bea",
    lastName: "Example",
    email: "bea@example.com",
    password: "hashed",
  });
});

after(async () => {
  await sequelize.close();
  fs.rmSync(process.env.DATABASE_PATH, { force: true });
});

test("the sender can edit within 24 hours and cannot edit someone else's message", async () => {
  const message = await Message.create({ senderId: 1, receiverId: 2, content: "Hello", isRead: false });
  const edited = await editOwnMessage(Message, {
    userId: 1,
    messageId: message.id,
    content: "Hello there",
    now: new Date(message.createdAt.getTime() + 60 * 1000),
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.content, "Hello there");
  assert.ok(edited.body.editedAt);

  const foreign = await editOwnMessage(Message, {
    userId: 2,
    messageId: message.id,
    content: "Nope",
  });
  assert.equal(foreign.status, 404);

  const late = await editOwnMessage(Message, {
    userId: 1,
    messageId: message.id,
    content: "Too late",
    now: new Date(message.createdAt.getTime() + 25 * 60 * 60 * 1000),
  });
  assert.equal(late.status, 400);
});

test("delete hides the text and is only for the sender", async () => {
  const message = await Message.create({ senderId: 1, receiverId: 2, content: "Secret plan", isRead: false });
  const foreign = await deleteOwnMessage(Message, { userId: 2, messageId: message.id });
  assert.equal(foreign.status, 404);

  const deleted = await deleteOwnMessage(Message, { userId: 1, messageId: message.id });
  assert.equal(deleted.status, 200);
  assert.ok(deleted.body.deletedAt);
  const stored = await Message.findByPk(message.id);
  assert.equal(stored.content, "This message was deleted");
});
