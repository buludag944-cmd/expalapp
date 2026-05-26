const PR_RULES = {
  Ireland: { daysRequired: 1825, yearsLabel: 5 },
  Germany: { daysRequired: 1825, yearsLabel: 5 },
  Netherlands: { daysRequired: 1825, yearsLabel: 5 },
  "United Kingdom": { daysRequired: 1825, yearsLabel: 5 },
  default: { daysRequired: 1825, yearsLabel: 5 },
};

const CITIZENSHIP_YEARS = {
  Ireland: 5,
  Germany: 8,
  Netherlands: 5,
  "United Kingdom": 6,
  default: 5,
};

function calcDaysPresent(arrivalDate, absences = []) {
  if (!arrivalDate) return 0;
  const start = new Date(arrivalDate);
  const today = new Date();
  const totalDays = Math.floor((today - start) / (1000 * 60 * 60 * 24));
  const absent = absences.reduce((sum, a) => sum + (a.days || 0), 0);
  return Math.max(0, totalDays - absent);
}

function calcPREligibilityDate(arrivalDate, country) {
  if (!arrivalDate) return null;
  const rule = PR_RULES[country] || PR_RULES.default;
  const d = new Date(arrivalDate);
  d.setDate(d.getDate() + rule.daysRequired);
  return d;
}

function calcCitizenshipEligibilityDate(arrivalDate, country) {
  if (!arrivalDate) return null;
  const years = CITIZENSHIP_YEARS[country] || CITIZENSHIP_YEARS.default;
  const d = new Date(arrivalDate);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function prProgressPercent(daysPresent, country) {
  const rule = PR_RULES[country] || PR_RULES.default;
  return Math.min(100, Math.round((daysPresent / rule.daysRequired) * 100));
}

module.exports = {
  calcDaysPresent,
  calcPREligibilityDate,
  calcCitizenshipEligibilityDate,
  prProgressPercent,
  PR_RULES,
};
