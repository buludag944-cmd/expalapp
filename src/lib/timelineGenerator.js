const path = require("path");
const fs = require("fs");
const { detectPhase } = require("./phaseDetector");

const templatesPath = path.join(__dirname, "../../data/timelineTasks.json");

function loadTemplates() {
  const raw = fs.readFileSync(templatesPath, "utf8");
  const data = JSON.parse(raw);
  return data.default || [];
}

function getTemplateTasks() {
  return loadTemplates();
}

/**
 * @param {object} user Sequelize user with moveDate, arrivalDate, destinationCountry, visaType, familyStatus
 * @returns {object[]}
 */
function generateTasks(user) {
  const templates = getTemplateTasks();
  const moveDate = user.moveDate ? new Date(user.moveDate) : new Date();
  const phase = detectPhase(user.arrivalDate);

  return templates
    .filter((t) => {
      const order = ["relocation", "integration", "establishment", "longterm"];
      return order.indexOf(t.phase) <= order.indexOf(phase);
    })
    .map((t) => ({
      title: t.title,
      description: t.description,
      category: t.category,
      dueOffsetDays: t.due_offset_days,
      phase: t.phase,
      dueDate: addDays(moveDate, t.due_offset_days),
    }));
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

module.exports = { generateTasks, getTemplateTasks };
