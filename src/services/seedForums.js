const { ForumSpace } = require("../bootstrapModels");
const { loadSpaces } = require("../lib/forumSubscriber");

async function seedForumSpacesIfEmpty() {
  const spaces = loadSpaces();
  const count = await ForumSpace.count();
  if (count === 0) {
    await ForumSpace.bulkCreate(
      spaces.map((s) => ({
        name: s.name,
        description: s.description,
        countryTag: !!s.countryTag,
        phaseTag: s.phaseTag || null,
      }))
    );
    console.log("[seed] Forum spaces created");
    return;
  }

  // Ensure newly added spaces (e.g. App General) exist on already-seeded DBs
  let added = 0;
  for (const s of spaces) {
    const exists = await ForumSpace.findOne({ where: { name: s.name } });
    if (!exists) {
      await ForumSpace.create({
        name: s.name,
        description: s.description,
        countryTag: !!s.countryTag,
        phaseTag: s.phaseTag || null,
      });
      added += 1;
    }
  }
  if (added > 0) {
    console.log(`[seed] Added ${added} missing forum space(s)`);
  }
}

module.exports = { seedForumSpacesIfEmpty };
