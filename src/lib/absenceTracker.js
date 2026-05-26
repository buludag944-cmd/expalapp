function daysBetween(fromDate, toDate) {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  return Math.max(0, Math.floor((to - from) / (1000 * 60 * 60 * 24)) + 1);
}

function getTotalAbsenceDays(absences, year) {
  return absences
    .filter((a) => {
      const y = new Date(a.fromDate).getFullYear();
      return y === year;
    })
    .reduce((sum, a) => sum + (a.days || daysBetween(a.fromDate, a.toDate)), 0);
}

const THRESHOLDS = {
  Ireland: 90,
  Germany: 183,
  Netherlands: 180,
  "United Kingdom": 180,
  default: 90,
};

function getAbsenceRiskLevel(totalDays, country) {
  const limit = THRESHOLDS[country] || THRESHOLDS.default;
  const warn = Math.floor(limit * 0.75);
  if (totalDays >= limit) return "critical";
  if (totalDays >= warn) return "warning";
  return "safe";
}

module.exports = {
  daysBetween,
  getTotalAbsenceDays,
  getAbsenceRiskLevel,
  THRESHOLDS,
};
