const { TimelineTask } = require("../bootstrapModels");
const { generateTasks } = require("./timelineGenerator");

/** Add any missing timeline tasks after employment status (or profile) changes. */
async function ensureEmploymentTasksForUser(user) {
  const generated = generateTasks(user);
  const existing = await TimelineTask.findAll({
    where: { userId: user.id },
    attributes: ["title"],
  });
  const seen = new Set(existing.map((t) => t.title.toLowerCase()));
  let added = 0;
  for (const t of generated) {
    const key = t.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    await TimelineTask.create({
      userId: user.id,
      title: t.title,
      description: t.description,
      category: t.category,
      dueOffsetDays: t.dueOffsetDays,
      dueDate: t.dueDate,
      phase: t.phase,
    });
    added += 1;
  }
  return added;
}

module.exports = { ensureEmploymentTasksForUser };
