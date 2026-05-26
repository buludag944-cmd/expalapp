const path = require("path");
const fs = require("fs");

const spacesPath = path.join(__dirname, "../../data/forumSpaces.json");

function loadSpaces() {
  return JSON.parse(fs.readFileSync(spacesPath, "utf8"));
}

const ALWAYS = ["Career & Work"];
const BY_COUNTRY = [
  "Tax & Finance",
  "Banking & Money",
  "Visa & Legal",
  "Healthcare",
  "Housing & Renting",
];
const FAMILY = ["Family & Kids"];

/**
 * @param {object} user
 * @returns {string[]} space names to subscribe
 */
function getSubscriptionSpaceNames(user) {
  const names = [...ALWAYS, ...BY_COUNTRY];
  if (user.familyStatus === "family_with_kids") {
    names.push(...FAMILY);
  }
  return [...new Set(names)];
}

/**
 * @param {object} user
 * @param {import('sequelize').Model[]} allSpaces ForumSpace rows
 */
function autoSubscribe(user, allSpaces) {
  const want = getSubscriptionSpaceNames(user);
  return allSpaces.filter((s) => want.includes(s.name));
}

function canAccessSpace(userPhase, spacePhaseTag) {
  if (!spacePhaseTag) return true;
  const order = ["relocation", "integration", "establishment", "longterm"];
  return order.indexOf(userPhase) >= order.indexOf(spacePhaseTag);
}

module.exports = {
  loadSpaces,
  getSubscriptionSpaceNames,
  autoSubscribe,
  canAccessSpace,
};
