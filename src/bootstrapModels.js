/**
 * Central model registration + associations (used by server.js and scripts/reset-db.js).
 * Reset database for clean single-user test — scripts require this before sequelize.sync({ force: true }).
 */
const sequelize = require("./config/database");
const User = require("./models/User");
const Housing = require("./models/Housing");
const Referral = require("./models/Referral");
const Message = require("./models/Message");
const Event = require("./models/Event");
const EssentialPost = require("./models/EssentialPost");
const KnowHowPost = require("./models/KnowHowPost");
const Comment = require("./models/Comment");

User.hasMany(Housing, { foreignKey: "userId" });
Housing.belongsTo(User, { foreignKey: "userId" });
User.hasMany(Referral, { foreignKey: "userId" });
Referral.belongsTo(User, { foreignKey: "userId" });
User.hasMany(Message, { as: "SentMessages", foreignKey: "senderId" });
User.hasMany(Message, { as: "ReceivedMessages", foreignKey: "receiverId" });
Message.belongsTo(User, { as: "Sender", foreignKey: "senderId" });
Message.belongsTo(User, { as: "Receiver", foreignKey: "receiverId" });
User.hasMany(Event, { foreignKey: "createdBy" });
Event.belongsTo(User, { foreignKey: "createdBy" });
User.hasMany(EssentialPost, { foreignKey: "createdBy" });
EssentialPost.belongsTo(User, { foreignKey: "createdBy" });
User.hasMany(KnowHowPost, { foreignKey: "createdBy" });
KnowHowPost.belongsTo(User, { foreignKey: "createdBy" });

module.exports = {
  sequelize,
  User,
  Housing,
  Referral,
  Message,
  Event,
  EssentialPost,
  KnowHowPost,
  Comment,
};
