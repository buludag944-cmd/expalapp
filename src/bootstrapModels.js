/**
 * Central model registration + associations (used by server.js and scripts/reset-db.js).
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
const DeviceToken = require("./models/DeviceToken");
const TimelineTask = require("./models/TimelineTask");
const ForumSpace = require("./models/ForumSpace");
const ForumThread = require("./models/ForumThread");
const ForumReply = require("./models/ForumReply");
const ForumSubscription = require("./models/ForumSubscription");
const MentorMatch = require("./models/MentorMatch");
const ResidencyRecord = require("./models/ResidencyRecord");
const AbsenceLog = require("./models/AbsenceLog");
const Document = require("./models/Document");
const LifeAbroadScore = require("./models/LifeAbroadScore");
const FeatureEvent = require("./models/FeatureEvent");

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
User.hasMany(DeviceToken, { foreignKey: "userId", onDelete: "CASCADE" });
DeviceToken.belongsTo(User, { foreignKey: "userId" });

User.hasMany(TimelineTask, { foreignKey: "userId" });
TimelineTask.belongsTo(User, { foreignKey: "userId" });
User.hasMany(ForumThread, { foreignKey: "authorId" });
ForumThread.belongsTo(User, { as: "Author", foreignKey: "authorId" });
ForumSpace.hasMany(ForumThread, { foreignKey: "spaceId" });
ForumThread.belongsTo(ForumSpace, { foreignKey: "spaceId" });
ForumThread.hasMany(ForumReply, { foreignKey: "threadId" });
ForumReply.belongsTo(ForumThread, { foreignKey: "threadId" });
ForumReply.belongsTo(User, { as: "Author", foreignKey: "authorId" });
User.hasMany(ForumSubscription, { foreignKey: "userId" });
ForumSubscription.belongsTo(User, { foreignKey: "userId" });
ForumSubscription.belongsTo(ForumSpace, { foreignKey: "spaceId" });
User.hasMany(MentorMatch, { as: "MentorMatches", foreignKey: "mentorId" });
User.hasMany(MentorMatch, { as: "MenteeMatches", foreignKey: "menteeId" });
User.hasOne(ResidencyRecord, { foreignKey: "userId" });
ResidencyRecord.belongsTo(User, { foreignKey: "userId" });
User.hasMany(AbsenceLog, { foreignKey: "userId" });
AbsenceLog.belongsTo(User, { foreignKey: "userId" });
User.hasMany(Document, { foreignKey: "userId" });
Document.belongsTo(User, { foreignKey: "userId" });
User.hasOne(LifeAbroadScore, { foreignKey: "userId" });
LifeAbroadScore.belongsTo(User, { foreignKey: "userId" });
User.hasMany(FeatureEvent, { foreignKey: "userId" });

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
  DeviceToken,
  TimelineTask,
  ForumSpace,
  ForumThread,
  ForumReply,
  ForumSubscription,
  MentorMatch,
  ResidencyRecord,
  AbsenceLog,
  Document,
  LifeAbroadScore,
  FeatureEvent,
};
