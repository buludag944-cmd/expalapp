const { FeatureEvent } = require("../bootstrapModels");
const { detectPhase } = require("./phaseDetector");

async function track(userId, feature, action, user) {
  const phase = user?.phase || detectPhase(user?.arrivalDate);
  return FeatureEvent.create({
    userId,
    feature,
    action,
    phase,
  });
}

module.exports = { track };
