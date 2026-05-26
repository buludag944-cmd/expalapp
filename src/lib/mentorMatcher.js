const { monthsDiff } = require("./phaseDetector");

/**
 * @param {object} mentor User row
 * @param {object} mentee User row
 * @returns {number}
 */
function scoreMentorMatch(mentor, mentee) {
  let score = 0;
  if (
    mentor.destinationCity &&
    mentee.destinationCity &&
    mentor.destinationCity.toLowerCase() === mentee.destinationCity.toLowerCase()
  ) {
    score += 50;
  } else {
    return 0;
  }
  if (
    mentor.professionCategory &&
    mentee.professionCategory &&
    mentor.professionCategory === mentee.professionCategory
  ) {
    score += 25;
  }
  if (mentor.visaType && mentee.visaType && mentor.visaType === mentee.visaType) {
    score += 15;
  }
  if (mentor.arrivalDate) {
    const months = monthsDiff(new Date(mentor.arrivalDate), new Date());
    if (months >= 3 && months <= 18) score += 10;
  }
  if (mentor.availabilityForMentorCalls) score += 5;
  return score;
}

/**
 * @param {object} mentee
 * @param {object[]} candidates verified mentors in same city
 */
function findMatches(mentee, candidates) {
  return candidates
    .map((m) => ({ mentor: m, score: scoreMentorMatch(m, mentee) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function isMentorEligible(user, completedTaskCount = 0) {
  if (!user.arrivalDate) return false;
  const months = monthsDiff(new Date(user.arrivalDate), new Date());
  return months >= 3 && completedTaskCount >= 5 && user.isMentor;
}

module.exports = { scoreMentorMatch, findMatches, isMentorEligible };
