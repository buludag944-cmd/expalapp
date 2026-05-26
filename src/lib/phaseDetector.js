/** @typedef {'relocation'|'integration'|'establishment'|'longterm'} Phase */

function monthsDiff(from, to) {
  const years = to.getFullYear() - from.getFullYear();
  const months = to.getMonth() - from.getMonth();
  return years * 12 + months;
}

/**
 * @param {string|null|undefined} arrivalDate ISO date string
 * @returns {Phase}
 */
function detectPhase(arrivalDate) {
  if (!arrivalDate) return "relocation";
  const months = monthsDiff(new Date(arrivalDate), new Date());
  if (months < 3) return "relocation";
  if (months < 18) return "integration";
  if (months < 36) return "establishment";
  return "longterm";
}

function phaseLabel(phase, city) {
  const c = city || "your city";
  switch (phase) {
    case "relocation":
      return "Recently arrived";
    case "integration":
      return `Settling in ${c}`;
    case "establishment":
      return "Established resident";
    case "longterm":
      return `Lifer in ${c}`;
    default:
      return "";
  }
}

function phaseColor(phase) {
  switch (phase) {
    case "relocation":
      return "orange";
    case "integration":
      return "blue";
    case "establishment":
      return "green";
    case "longterm":
      return "purple";
    default:
      return "gray";
  }
}

module.exports = { detectPhase, monthsDiff, phaseLabel, phaseColor };
