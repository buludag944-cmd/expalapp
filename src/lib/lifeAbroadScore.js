/**
 * @param {object} ctx aggregated user activity
 * @returns {{ totalScore: number, legalStability: number, careerProgress: number, financialHealth: number, socialIntegration: number, languageProgress: number, localRoots: number, tips: string[] }}
 */
function calculateScore(ctx) {
  const legalStability = scoreLegal(ctx);
  const careerProgress = scoreCareer(ctx);
  const financialHealth = scoreFinancial(ctx);
  const socialIntegration = scoreSocial(ctx);
  const languageProgress = Math.min(20, (ctx.languageMilestone || 0) * 4);
  const localRoots = scoreRoots(ctx);
  const totalScore =
    legalStability +
    careerProgress +
    financialHealth +
    socialIntegration +
    languageProgress +
    localRoots;

  return {
    totalScore,
    legalStability,
    careerProgress,
    financialHealth,
    socialIntegration,
    languageProgress,
    localRoots,
    tips: getImprovementTips({
      legalStability,
      careerProgress,
      financialHealth,
      socialIntegration,
      languageProgress,
      localRoots,
    }),
  };
}

function scoreLegal(ctx) {
  let s = 0;
  if (ctx.hasResidencyRecord) s += 8;
  if (!ctx.docExpiringSoon) s += 7;
  if (!ctx.visaExpiringSoon) s += 5;
  return Math.min(20, s);
}

function scoreCareer(ctx) {
  let s = 0;
  if (ctx.employerName) s += 7;
  if (ctx.credentialChecked) s += 7;
  if (ctx.salaryBenchmarkDone) s += 6;
  return Math.min(20, s);
}

function scoreFinancial(ctx) {
  let s = 0;
  if (ctx.bankingTipEngaged) s += 10;
  if (ctx.taxTaskCompleted) s += 10;
  return Math.min(20, s);
}

function scoreSocial(ctx) {
  let s = 0;
  if (ctx.eventRsvps >= 2) s += 7;
  if (ctx.forumReplies >= 3) s += 7;
  if (ctx.activeMentorMatch) s += 6;
  return Math.min(20, s);
}

function scoreRoots(ctx) {
  let s = 0;
  if (ctx.housingEngaged) s += 10;
  if (ctx.knowHowContributions >= 2) s += 10;
  return Math.min(20, s);
}

function getImprovementTips(scores) {
  const tips = [];
  if (scores.financialHealth < 15) tips.push("Complete your first tax task to improve Financial Health.");
  if (scores.socialIntegration < 15) tips.push("RSVP to 2 events or reply in forums to boost Social Integration.");
  if (scores.careerProgress < 15) tips.push("Run the salary benchmark or credential checker in Career Tools.");
  if (scores.legalStability < 15) tips.push("Upload documents and track your residency clock.");
  if (scores.languageProgress < 10) tips.push("Update your language progress on the Journey tab.");
  return tips;
}

module.exports = { calculateScore, getImprovementTips };
