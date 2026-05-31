const express = require("express");
const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const {
  User,
  TimelineTask,
  ForumSpace,
  ForumThread,
  ForumReply,
  ForumSubscription,
  MentorMatch,
  ResidencyRecord,
  AbsenceLog,
  Document,
  LifeAbroadScore,
  Event,
  KnowHowPost,
} = require("../bootstrapModels");
const { verifyToken } = require("../middleware/auth");
const { detectPhase, monthsDiff } = require("../lib/phaseDetector");
const { generateTasks } = require("../lib/timelineGenerator");
const { autoSubscribe, canAccessSpace } = require("../lib/forumSubscriber");
const { findMatches } = require("../lib/mentorMatcher");
const {
  calcDaysPresent,
  calcPREligibilityDate,
  calcCitizenshipEligibilityDate,
  prProgressPercent,
} = require("../lib/residencyCalculator");
const { daysBetween, getTotalAbsenceDays, getAbsenceRiskLevel } = require("../lib/absenceTracker");
const { calculateScore } = require("../lib/lifeAbroadScore");
const { isOwnerOrAdmin } = require("../lib/ownership");

const router = express.Router();
router.use(verifyToken);

function serializeUser(user) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    isAdmin: !!user.isAdmin,
    nationality: user.nationality,
    currentCity: user.currentCity,
    company: user.company,
    interests: user.interests,
    industry: user.industry,
    bio: user.bio,
    profileImage: user.profileImage,
    profession: user.profession,
    professionCategory: user.professionCategory,
    homeCountry: user.homeCountry,
    destinationCountry: user.destinationCountry,
    destinationCity: user.destinationCity,
    moveDate: user.moveDate,
    arrivalDate: user.arrivalDate,
    visaType: user.visaType,
    employerName: user.employerName,
    familyStatus: user.familyStatus,
    phase: user.phase,
    onboardingComplete: !!user.onboardingComplete,
    concerns: user.concerns,
    isMentor: !!user.isMentor,
    mentorVerified: !!user.mentorVerified,
    availabilityForMentorCalls: !!user.availabilityForMentorCalls,
    languages: user.languages,
    previousCountries: user.previousCountries,
    profilePublic: user.profilePublic !== false,
    lifeAbroadScore: user.lifeAbroadScore || 0,
    languageMilestone: user.languageMilestone || 0,
  };
}

async function refreshUserPhase(user) {
  const phase = detectPhase(user.arrivalDate);
  if (user.phase !== phase) {
    await user.update({ phase });
  }
  return phase;
}

// POST /api/journey/onboarding
router.post("/onboarding", async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const body = req.body || {};
    const alreadyArrived = !!body.alreadyArrived;
    const moveDate = body.moveDate || null;
    const arrivalDate = alreadyArrived ? body.arrivalDate : body.arrivalDate || moveDate;
    const phase = detectPhase(arrivalDate);

    await user.update({
      destinationCountry: body.destinationCountry,
      destinationCity: body.destinationCity,
      profession: body.profession,
      professionCategory: body.professionCategory,
      homeCountry: body.homeCountry || user.nationality,
      moveDate,
      arrivalDate,
      visaType: body.visaType,
      familyStatus: body.familyStatus,
      concerns: body.concerns || [],
      phase,
      onboardingComplete: true,
      currentCity: body.destinationCity || user.currentCity,
    });

    const tasks = generateTasks(user);
    await TimelineTask.destroy({ where: { userId: user.id } });
    await TimelineTask.bulkCreate(
      tasks.map((t) => ({
        userId: user.id,
        title: t.title,
        description: t.description,
        category: t.category,
        dueOffsetDays: t.dueOffsetDays,
        dueDate: t.dueDate,
        phase: t.phase,
      }))
    );

    const spaces = await ForumSpace.findAll();
    const subs = autoSubscribe(user, spaces);
    await ForumSubscription.destroy({ where: { userId: user.id } });
    if (subs.length) {
      await ForumSubscription.bulkCreate(
        subs.map((s) => ({ userId: user.id, spaceId: s.id }))
      );
    }

    const mentors = await User.findAll({
      where: {
        isMentor: true,
        mentorVerified: true,
        destinationCity: user.destinationCity,
        id: { [Op.ne]: user.id },
      },
    });
    const matches = findMatches(user, mentors);
    if (matches.length) {
      const best = matches[0].mentor;
      const existing = await MentorMatch.findOne({
        where: { menteeId: user.id, status: { [Op.in]: ["pending", "active"] } },
      });
      if (!existing) {
        await MentorMatch.create({
          mentorId: best.id,
          menteeId: user.id,
          destinationCountry: user.destinationCountry,
          destinationCity: user.destinationCity,
          profession: user.profession,
          status: "pending",
          initiatedBy: "system",
        });
      }
    }

    const prDate = calcPREligibilityDate(arrivalDate, user.destinationCountry);
    const citDate = calcCitizenshipEligibilityDate(arrivalDate, user.destinationCountry);
    await ResidencyRecord.upsert({
      userId: user.id,
      country: user.destinationCountry,
      visaType: user.visaType,
      visaStartDate: arrivalDate,
      prEligibilityDate: prDate ? prDate.toISOString().slice(0, 10) : null,
      citizenshipEligibilityDate: citDate ? citDate.toISOString().slice(0, 10) : null,
      daysRequiredForPr: 1825,
      daysPresentInCountry: calcDaysPresent(arrivalDate, []),
    });

    await user.reload();
    res.json({ user: serializeUser(user), taskCount: tasks.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/journey/dashboard
router.get("/dashboard", async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const phase = await refreshUserPhase(user);

    const tasks = await TimelineTask.findAll({
      where: { userId: user.id, isCompleted: false },
      order: [["dueDate", "ASC"]],
      limit: 20,
    });
    const today = new Date().toISOString().slice(0, 10);
    const urgent = tasks
      .filter((t) => t.dueDate && t.dueDate <= today)
      .concat(tasks.filter((t) => !t.dueDate || t.dueDate > today))
      .slice(0, 3);

    const match = await MentorMatch.findOne({
      where: { menteeId: user.id, status: { [Op.in]: ["pending", "active"] } },
      order: [["createdAt", "DESC"]],
    });
    let mentor = null;
    if (match) {
      mentor = await User.findByPk(match.mentorId, {
        attributes: ["id", "firstName", "lastName", "profession", "professionCategory"],
      });
    }

    const scoreRow = await LifeAbroadScore.findOne({ where: { userId: user.id } });
    const residency = await ResidencyRecord.findOne({ where: { userId: user.id } });

    let contextualThread = null;
    if (urgent[0]) {
      contextualThread = await ForumThread.findOne({
        where: { cityTag: user.destinationCity },
        order: [["lastActivityAt", "DESC"]],
      });
    }

    let phaseCard = {};
    if (phase === "relocation" && user.moveDate) {
      const days = Math.ceil((new Date(user.moveDate) - new Date()) / (86400000));
      phaseCard = { type: "countdown", label: days > 0 ? `Moving in ${days} days` : "Move day!" };
    } else if (phase === "integration" && user.arrivalDate) {
      const months = monthsDiff(new Date(user.arrivalDate), new Date());
      phaseCard = {
        type: "months",
        label: `${months} month${months === 1 ? "" : "s"} in ${user.destinationCity || "your city"}`,
      };
    } else if (phase === "establishment" && residency) {
      phaseCard = {
        type: "pr",
        percent: prProgressPercent(residency.daysPresentInCountry, user.destinationCountry),
      };
    } else if (phase === "longterm") {
      phaseCard = { type: "lifer", label: `Lifer in ${user.destinationCity || "your city"}` };
    }

    res.json({
      user: serializeUser(user),
      phase,
      urgentTasks: urgent,
      mentorMatch: match
        ? { status: match.status, mentor }
        : null,
      lifeAbroadScore: scoreRow,
      showScore: ["integration", "establishment", "longterm"].includes(phase),
      phaseCard,
      contextualThread,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/journey/timeline
router.get("/timeline", async (req, res) => {
  try {
    const tasks = await TimelineTask.findAll({
      where: { userId: req.user.id },
      order: [["dueDate", "ASC"]],
    });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/journey/timeline/:id
router.patch("/timeline/:id", async (req, res) => {
  try {
    const task = await TimelineTask.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!task) return res.status(404).json({ error: "Task not found" });
    const isCompleted = !!req.body.isCompleted;
    await task.update({
      isCompleted,
      completedAt: isCompleted ? new Date() : null,
    });
    await recalcScore(req.user.id);
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Forums
router.get("/forums/spaces", async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    const phase = user.phase || detectPhase(user.arrivalDate);
    const spaces = await ForumSpace.findAll({ order: [["name", "ASC"]] });
    const visible = spaces.filter((s) => canAccessSpace(phase, s.phaseTag));
    res.json(visible);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/forums/spaces/:spaceId/threads", async (req, res) => {
  try {
    const threads = await ForumThread.findAll({
      where: { spaceId: req.params.spaceId },
      include: [{ model: User, as: "Author", attributes: ["id", "firstName", "lastName", "profession", "destinationCity"] }],
      order: [
        ["pinned", "DESC"],
        ["lastActivityAt", "DESC"],
      ],
    });
    res.json(threads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/forums/threads/:id", async (req, res) => {
  try {
    const thread = await ForumThread.findByPk(req.params.id, {
      include: [{ model: User, as: "Author", attributes: ["id", "firstName", "lastName", "profession", "destinationCity", "arrivalDate"] }],
    });
    if (!thread) return res.status(404).json({ error: "Not found" });
    const replies = await ForumReply.findAll({
      where: { threadId: thread.id },
      include: [{ model: User, as: "Author", attributes: ["id", "firstName", "lastName", "profession", "arrivalDate"] }],
      order: [["createdAt", "ASC"]],
    });
    res.json({ thread, replies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/forums/threads", async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    const { spaceId, title, body, professionTag } = req.body;
    if (!spaceId || !title || !body) {
      return res.status(400).json({ error: "spaceId, title, and body required" });
    }
    const thread = await ForumThread.create({
      spaceId,
      authorId: user.id,
      title: title.trim(),
      body: body.trim(),
      countryTag: user.destinationCountry,
      cityTag: user.destinationCity,
      professionTag: professionTag || user.professionCategory,
      phaseTag: user.phase,
    });
    res.status(201).json(thread);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/forums/threads/:id/replies", async (req, res) => {
  try {
    const thread = await ForumThread.findByPk(req.params.id);
    if (!thread) return res.status(404).json({ error: "Thread not found" });
    const body = (req.body.body || "").trim();
    if (!body) return res.status(400).json({ error: "body required" });
    const reply = await ForumReply.create({
      threadId: thread.id,
      authorId: req.user.id,
      body,
    });
    await thread.update({
      replyCount: thread.replyCount + 1,
      lastActivityAt: new Date(),
    });
    res.status(201).json(reply);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

function canModifyForumAuthor(user, authorId) {
  return isOwnerOrAdmin(user, authorId);
}

router.patch("/forums/threads/:id", async (req, res) => {
  try {
    const thread = await ForumThread.findByPk(req.params.id);
    if (!thread) return res.status(404).json({ error: "Thread not found" });
    const user = await User.findByPk(req.user.id);
    if (!canModifyForumAuthor(user, thread.authorId)) {
      return res.status(403).json({ error: "You can only edit your own threads." });
    }
    const title = req.body.title != null ? String(req.body.title).trim() : thread.title;
    const body = req.body.body != null ? String(req.body.body).trim() : thread.body;
    if (!title || !body) {
      return res.status(400).json({ error: "title and body are required" });
    }
    await thread.update({ title, body, lastActivityAt: new Date() });
    res.json(thread);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/forums/threads/:id", async (req, res) => {
  try {
    const thread = await ForumThread.findByPk(req.params.id);
    if (!thread) return res.status(404).json({ error: "Thread not found" });
    const user = await User.findByPk(req.user.id);
    if (!canModifyForumAuthor(user, thread.authorId)) {
      return res.status(403).json({ error: "You can only delete your own threads." });
    }
    await ForumReply.destroy({ where: { threadId: thread.id } });
    await thread.destroy();
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch("/forums/replies/:replyId", async (req, res) => {
  try {
    const reply = await ForumReply.findByPk(req.params.replyId);
    if (!reply) return res.status(404).json({ error: "Reply not found" });
    const user = await User.findByPk(req.user.id);
    if (!canModifyForumAuthor(user, reply.authorId)) {
      return res.status(403).json({ error: "You can only edit your own replies." });
    }
    const body = (req.body.body || "").trim();
    if (!body) return res.status(400).json({ error: "body required" });
    await reply.update({ body });
    const thread = await ForumThread.findByPk(reply.threadId);
    if (thread) await thread.update({ lastActivityAt: new Date() });
    res.json(reply);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/forums/replies/:replyId", async (req, res) => {
  try {
    const reply = await ForumReply.findByPk(req.params.replyId);
    if (!reply) return res.status(404).json({ error: "Reply not found" });
    const user = await User.findByPk(req.user.id);
    if (!canModifyForumAuthor(user, reply.authorId)) {
      return res.status(403).json({ error: "You can only delete your own replies." });
    }
    const thread = await ForumThread.findByPk(reply.threadId);
    await reply.destroy();
    if (thread) {
      await thread.update({
        replyCount: Math.max(0, (thread.replyCount || 1) - 1),
        lastActivityAt: new Date(),
      });
    }
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Mentors
router.get("/mentors/match", async (req, res) => {
  try {
    const match = await MentorMatch.findOne({
      where: { menteeId: req.user.id },
      order: [["createdAt", "DESC"]],
    });
    if (!match) return res.json(null);
    const mentor = await User.findByPk(match.mentorId, {
      attributes: ["id", "firstName", "lastName", "profession", "professionCategory", "destinationCity"],
    });
    res.json({ ...match.toJSON(), mentor });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/mentors/match/:id/accept", async (req, res) => {
  try {
    const match = await MentorMatch.findOne({
      where: { id: req.params.id, mentorId: req.user.id },
    });
    if (!match) return res.status(404).json({ error: "Match not found" });
    await match.update({ status: "active" });
    res.json(match);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Residency
router.get("/residency", async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    let record = await ResidencyRecord.findOne({ where: { userId: user.id } });
    const absences = await AbsenceLog.findAll({ where: { userId: user.id } });
    const daysPresent = calcDaysPresent(user.arrivalDate, absences);
    const year = new Date().getFullYear();
    const absentYtd = getTotalAbsenceDays(absences, year);
    const risk = getAbsenceRiskLevel(absentYtd, user.destinationCountry);

    if (record) {
      await record.update({ daysPresentInCountry: daysPresent });
    }

    res.json({
      record,
      absences,
      absentYtd,
      absenceRisk: risk,
      prProgress: prProgressPercent(daysPresent, user.destinationCountry),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/residency/absences", async (req, res) => {
  try {
    const { fromDate, toDate, reason } = req.body;
    if (!fromDate || !toDate) {
      return res.status(400).json({ error: "fromDate and toDate required" });
    }
    const days = daysBetween(fromDate, toDate);
    const log = await AbsenceLog.create({
      userId: req.user.id,
      fromDate,
      toDate,
      days,
      reason: reason || null,
    });
    res.status(201).json(log);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Documents
router.get("/documents", async (req, res) => {
  try {
    const docs = await Document.findAll({
      where: { userId: req.user.id },
      order: [["expiryDate", "ASC"]],
    });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/documents", async (req, res) => {
  try {
    const { name, documentType, fileUrl, expiryDate } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    const doc = await Document.create({
      userId: req.user.id,
      name,
      documentType,
      fileUrl,
      expiryDate,
    });
    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Life abroad score
router.get("/score", async (req, res) => {
  try {
    const score = await recalcScore(req.user.id);
    res.json(score);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/score/language", async (req, res) => {
  try {
    const milestone = Math.min(5, Math.max(0, Number(req.body.milestone) || 0));
    await User.update({ languageMilestone: milestone }, { where: { id: req.user.id } });
    const score = await recalcScore(req.user.id);
    res.json(score);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Career tools data
router.get("/career/credential", async (req, res) => {
  const data = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../../data/credentialRecognition.json"), "utf8")
  );
  const cat = req.query.category || "default";
  const country = req.query.country || "default";
  const block = data[cat] || data.default;
  res.json(block[country] || block.default || data.default.default);
});

router.get("/career/salary", async (req, res) => {
  const data = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../../data/salaryBenchmarks.json"), "utf8")
  );
  const profession = req.query.profession || "default";
  const city = req.query.city || "default";
  const block = data[profession] || data.default;
  res.json(block[city] || block.default || data.default.default);
});

router.get("/visa-types/:country", async (req, res) => {
  const data = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../../data/visaTypes.json"), "utf8")
  );
  res.json(data[req.params.country] || data.default);
});

async function recalcScore(userId) {
  const user = await User.findByPk(userId);
  const completedTasks = await TimelineTask.count({
    where: { userId, isCompleted: true, category: "legal" },
  });
  const residency = await ResidencyRecord.findOne({ where: { userId } });
  const docs = await Document.findAll({ where: { userId } });
  const soon = new Date();
  soon.setDate(soon.getDate() + 60);
  const docExpiring = docs.some((d) => d.expiryDate && new Date(d.expiryDate) <= soon);
  const visaSoon =
    residency?.visaExpiryDate && new Date(residency.visaExpiryDate) <= soon;
  const forumReplies = await ForumReply.count({ where: { authorId: userId } });
  const mentorActive = await MentorMatch.count({
    where: {
      [Op.or]: [{ menteeId: userId }, { mentorId: userId }],
      status: "active",
    },
  });
  const knowHowCount = await KnowHowPost.count({ where: { createdBy: userId } });

  const result = calculateScore({
    hasResidencyRecord: !!residency,
    docExpiringSoon: docExpiring,
    visaExpiringSoon: visaSoon,
    employerName: user.employerName,
    credentialChecked: completedTasks > 0,
    salaryBenchmarkDone: user.concerns?.includes?.("career"),
    bankingTipEngaged: knowHowCount > 0,
    taxTaskCompleted: completedTasks > 0,
    eventRsvps: 0,
    forumReplies,
    activeMentorMatch: mentorActive > 0,
    languageMilestone: user.languageMilestone,
    housingEngaged: false,
    knowHowContributions: knowHowCount,
  });

  const { tips, ...scores } = result;
  const [row] = await LifeAbroadScore.upsert({
    userId,
    totalScore: scores.totalScore,
    legalStability: scores.legalStability,
    careerProgress: scores.careerProgress,
    financialHealth: scores.financialHealth,
    socialIntegration: scores.socialIntegration,
    languageProgress: scores.languageProgress,
    localRoots: scores.localRoots,
    lastCalculatedAt: new Date(),
  });
  await user.update({ lifeAbroadScore: scores.totalScore });
  return { ...scores, tips, lastCalculatedAt: row.lastCalculatedAt };
}

module.exports = router;
