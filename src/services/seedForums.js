const { ForumSpace } = require("../bootstrapModels");
const { loadSpaces } = require("../lib/forumSubscriber");

async function seedForumSpacesIfEmpty() {
  const count = await ForumSpace.count();
  if (count > 0) return;
  const spaces = loadSpaces();
  await ForumSpace.bulkCreate(
    spaces.map((s) => ({
      name: s.name,
      description: s.description,
      countryTag: !!s.countryTag,
      phaseTag: s.phaseTag || null,
    }))
  );
  console.log("[seed] Forum spaces created");
}

module.exports = { seedForumSpacesIfEmpty };
