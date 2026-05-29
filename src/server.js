// .env defaults + .env.local secrets (SMTP_USER, SMTP_PASS) — see scripts/ensure-env-local.js
require("./config/loadEnv");

console.log("[boot] starting server.js");

function logFatal(label, err) {
  console.error(`[boot] ${label}:`, err && err.stack ? err.stack : err);
  process.exit(1);
}

process.on("uncaughtException", (err) => logFatal("uncaughtException", err));
process.on("unhandledRejection", (reason) =>
  logFatal("unhandledRejection", reason)
);

const fs = require("fs");
const path = require("path");
const express = require("express");
const jwt = require("jsonwebtoken");
const {
  sequelize,
  User,
  Housing,
  Referral,
  Message,
  Event,
  EssentialPost,
  KnowHowPost,
  Comment,
} = require("./bootstrapModels");
const journeyRouter = require("./routes/journey");
const { seedForumSpacesIfEmpty } = require("./services/seedForums");
const { migrateExpatFields } = require("./migrations/migrateExpatFields");
const { migrateGoogleAuth } = require("./migrations/migrateGoogleAuth");
const eventsRouter = require("./routes/events"); // GET/POST /api/events
const commentRoutes = require("./routes/comments");
const { registerHandler, loginHandler, authRouter } = require("./routes/auth");
const adminRouter = require("./routes/admin");
const pushRouter = require("./routes/push");
const { sendPushToUser } = require("./services/push");
const { initEmailTransport } = require("./services/email");
const { isConfigured: firebaseEnvSet, getAdmin: initFirebaseAdmin } = require("./services/firebaseAdmin");
const { verifyToken } = require("./middleware/auth");
const { JWT_SECRET } = require("./config/jwt");
const { Op, fn, col, where } = require("sequelize");

const app = express();
// Default 3001 so the CRA dev server can use 3000; override with PORT
const port = Number(process.env.PORT) || 3001;

// CORS before /health — Netlify calls /health cross-origin before signup
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

// Must run before any router that reads req.body (events, auth, housing, etc.)
app.use(express.json()); // parse JSON request bodies

// Mount events resource under /api/events (Postman: GET/POST …/api/events)
app.use("/api/events", eventsRouter);
// Comments on events, housing listings, or referral posts — POST /api/comments · GET …/:targetType/:targetId
app.use("/api/comments", commentRoutes);
app.use("/api/push", pushRouter);
app.use("/api/journey", journeyRouter);

app.get("/api/users", async (_req, res) => {
  try {
    const users = await User.findAll({
      attributes: ["id", "firstName", "lastName", "email"],
      order: [["id", "ASC"]],
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Searchable expat profiles (no passwords) — used by Search Profiles page
app.get("/api/users/profiles", verifyToken, async (_req, res) => {
  try {
    const users = await User.findAll({
      attributes: [
        "id",
        "firstName",
        "lastName",
        "nationality",
        "currentCity",
        "company",
        "industry",
        "bio",
        "interests",
        "profileImage",
      ],
      order: [["id", "ASC"]],
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all referrals
app.get("/api/referrals", async (_req, res) => {
  try {
    const referrals = await Referral.findAll({
      include: [
        {
          model: User,
          attributes: ["id", "firstName", "lastName"],
        },
      ],
    });
    res.json(referrals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// POST new referral
app.post("/api/referrals", verifyToken, async (req, res) => {
  try {
    const { name, profession, company, message } = req.body;
    if (!name || !profession || !company || !message) {
      return res.status(400).json({ error: "All fields are required." });
    }
    const newReferral = await Referral.create({
      userId: req.user.id,
      name,
      profession,
      company,
      message,
    });
    res.status(201).json(newReferral);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET all housing listings
app.get("/api/housing", async (_req, res) => {
  try {
    const homes = await Housing.findAll({
      include: [
        {
          model: User,
          attributes: ["id", "firstName", "lastName"],
        },
      ],
    });
    res.json(homes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// POST a new housing listing
app.post("/api/housing", verifyToken, async (req, res) => {
  try {
    const { title, city, price, description, images } = req.body;
    if (!title || !city || !price) {
      return res.status(400).json({ error: "Title, city, and price are required." });
    }
    const newListing = await Housing.create({
      userId: req.user.id,
      title,
      city,
      price: Number(price),
      description: description || "",
      images: images || [],
    });
    res.status(201).json(newListing);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update housing listing by ID
app.put("/api/housing/:id", async (req, res) => {
  try {
    const listing = await Housing.findByPk(req.params.id);
    if (!listing) return res.status(404).json({ error: "Listing not found." });

    const { title, city, price, description, images } = req.body || {};

    if (title !== undefined && title === "") {
      return res.status(400).json({ error: "Title cannot be empty." });
    }
    if (city !== undefined && city === "") {
      return res.status(400).json({ error: "City cannot be empty." });
    }
    if (price !== undefined && (price === "" || Number.isNaN(Number(price)))) {
      return res.status(400).json({ error: "Price must be a number." });
    }

    const updated = await listing.update({
      ...(title !== undefined ? { title } : {}),
      ...(city !== undefined ? { city } : {}),
      ...(price !== undefined ? { price: Number(price) } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(images !== undefined ? { images } : {}),
    });

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
// DELETE listing by ID
app.delete("/api/housing/:id", async (req, res) => {
  try {
    const deleted = await Housing.destroy({ where: { id: req.params.id } });
    if (!deleted) return res.status(404).json({ error: "Listing not found." });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/register", registerHandler);

app.post("/api/login", loginHandler);

app.use("/api/auth", authRouter);
app.use("/api/admin", verifyToken, adminRouter);

app.get("/api/profile", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    res.json({
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
      lifeAbroadScore: user.lifeAbroadScore || 0,
    });
  } catch (err) {
    res.status(401).json({ error: "Invalid email or password." });
  }
});



// DELETE referral by ID
app.delete("/api/referrals/:id", async (req, res) => {
  try {
    const deleted = await Referral.destroy({ where: { id: req.params.id } });
    if (!deleted) return res.status(404).json({ error: "Referral not found." });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update referral by ID
app.put("/api/referrals/:id", async (req, res) => {
  try {
    const referral = await Referral.findByPk(req.params.id);
    if (!referral) return res.status(404).json({ error: "Referral not found." });

    const { name, profession, company, message } = req.body || {};

    if (name !== undefined && name === "") {
      return res.status(400).json({ error: "Name cannot be empty." });
    }
    if (profession !== undefined && profession === "") {
      return res.status(400).json({ error: "Profession cannot be empty." });
    }
    if (company !== undefined && company === "") {
      return res.status(400).json({ error: "Company cannot be empty." });
    }
    if (message !== undefined && message === "") {
      return res.status(400).json({ error: "Message cannot be empty." });
    }

    const updated = await referral.update({
      ...(name !== undefined ? { name } : {}),
      ...(profession !== undefined ? { profession } : {}),
      ...(company !== undefined ? { company } : {}),
      ...(message !== undefined ? { message } : {}),
    });

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update user profile
app.put("/api/profile", verifyToken, async (req, res) => {
  try {
    const body = req.body || {};
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const allowed = [
      "nationality", "currentCity", "interests", "industry", "bio", "profileImage",
      "company", "profession", "professionCategory", "employerName", "languages",
      "previousCountries", "profilePublic", "isMentor", "availabilityForMentorCalls",
    ];
    const patch = {};
    for (const key of allowed) {
      if (body[key] !== undefined) patch[key] = body[key];
    }
    const updated = await user.update(patch);
    res.json({
      id: updated.id,
      firstName: updated.firstName,
      lastName: updated.lastName,
      email: updated.email,
      isAdmin: !!updated.isAdmin,
      nationality: updated.nationality,
      currentCity: updated.currentCity,
      interests: updated.interests,
      industry: updated.industry,
      bio: updated.bio,
      profileImage: updated.profileImage,
      company: updated.company,
      profession: updated.profession,
      professionCategory: updated.professionCategory,
      employerName: updated.employerName,
      destinationCountry: updated.destinationCountry,
      destinationCity: updated.destinationCity,
      phase: updated.phase,
      onboardingComplete: !!updated.onboardingComplete,
      lifeAbroadScore: updated.lifeAbroadScore || 0,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET conversation with another user
app.get("/api/messages/:userId", verifyToken, async (req, res) => {
  try {
    const otherUserId = Number(req.params.userId);
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { senderId: req.user.id, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: req.user.id },
        ],
      },
      include: [
        { model: User, as: "Sender", attributes: ["id", "firstName", "lastName"] },
      ],
      order: [["createdAt", "ASC"]],
    });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// POST send a message
app.post("/api/messages", verifyToken, async (req, res) => {
  try {
    const { receiverId, content } = req.body;
    if (!receiverId || !content) {
      return res.status(400).json({ error: "Receiver and content required" });
    }
    const message = await Message.create({
      senderId: req.user.id,
      receiverId: Number(receiverId),
      content: content.trim(),
    });
    const messageWithSender = await Message.findByPk(message.id, {
      include: [{ model: User, as: "Sender", attributes: ["id", "firstName", "lastName"] }],
    });

    const sender = messageWithSender && messageWithSender.Sender;
    const senderName = sender
      ? `${sender.firstName || ""} ${sender.lastName || ""}`.trim() || "Someone"
      : "Someone";
    const preview = content.trim().slice(0, 120);
    sendPushToUser(Number(receiverId), {
      title: "New message on EXPal",
      body: `${senderName}: ${preview}`,
      data: { type: "message", peerId: String(req.user.id) },
    }).catch((err) => console.error("[push] message notify:", err.message || err));

    res.status(201).json(messageWithSender);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
// GET all conversations for current user
app.get("/api/conversations", verifyToken, async (req, res) => {
  try {
    const conversations = await Message.findAll({
      where: {
        [Op.or]: [{ senderId: req.user.id }, { receiverId: req.user.id }],
      },
      include: [
        { model: User, as: "Sender", attributes: ["id", "firstName", "lastName"] },
        { model: User, as: "Receiver", attributes: ["id", "firstName", "lastName"] },
      ],
      order: [["createdAt", "DESC"]],
      limit: 20,
    });
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----- Expat Essentials (community guides) -----
app.get("/api/essentials", async (_req, res) => {
  try {
    const rows = await EssentialPost.findAll({
      include: [{ model: User, attributes: ["id", "firstName", "lastName", "email"] }],
      order: [["createdAt", "DESC"]],
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/essentials/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const row = await EssentialPost.findByPk(id, {
      include: [{ model: User, attributes: ["id", "firstName", "lastName", "email"] }],
    });
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/essentials", verifyToken, async (req, res) => {
  try {
    const title = (req.body?.title ?? "").toString().trim();
    const category = (req.body?.category ?? "").toString().trim();
    const content = (req.body?.content ?? "").toString().trim();
    if (!title || !category || !content) {
      return res.status(400).json({ error: "title, category, and content are required" });
    }
    const post = await EssentialPost.create({
      title,
      category,
      content,
      createdBy: req.user.id,
    });
    const withUser = await EssentialPost.findByPk(post.id, {
      include: [{ model: User, attributes: ["id", "firstName", "lastName", "email"] }],
    });
    res.status(201).json(withUser);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ----- Local Know-How (tips & questions) -----
app.get("/api/knowhow", async (_req, res) => {
  try {
    const rows = await KnowHowPost.findAll({
      include: [{ model: User, attributes: ["id", "firstName", "lastName", "email"] }],
      order: [["createdAt", "DESC"]],
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/knowhow/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const row = await KnowHowPost.findByPk(id, {
      include: [{ model: User, attributes: ["id", "firstName", "lastName", "email"] }],
    });
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/knowhow", verifyToken, async (req, res) => {
  try {
    const title = (req.body?.title ?? "").toString().trim();
    const category = (req.body?.category ?? "").toString().trim();
    const content = (req.body?.content ?? "").toString().trim();
    if (!title || !category || !content) {
      return res.status(400).json({ error: "title, category, and content are required" });
    }
    const post = await KnowHowPost.create({
      title,
      category,
      content,
      createdBy: req.user.id,
    });
    const withUser = await KnowHowPost.findByPk(post.id, {
      include: [{ model: User, attributes: ["id", "firstName", "lastName", "email"] }],
    });
    res.status(201).json(withUser);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

console.log("[boot] routes mounted");

// Optional: serve CRA production build (no banner text on "/")
const frontendBuild = path.join(__dirname, "../../frontend/build");
if (fs.existsSync(path.join(frontendBuild, "index.html"))) {
  app.use(express.static(frontendBuild));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api") || req.path === "/health") {
      return next();
    }
    res.sendFile(path.join(frontendBuild, "index.html"));
  });
}

// Sync DB first, then start the server — never Comment.sync({ alter: true }); SQLite ALTER builds *_backup tables and can corrupt (e.g. Comments_backup missing).
// New columns (e.g. verifyTokenExpiresAt): local dev can run `npm run reset-db` once to recreate schema from models.
// Full reset: node scripts/reset-db.js OR DB_FORCE_RESET=1 once then unset (wipes tables without deleting the file — still avoids ALTER).
const DB_FORCE_RESET = process.env.DB_FORCE_RESET === "1";

sequelize
  .sync(DB_FORCE_RESET ? { force: true } : {})
  .then(async () => {
    console.log(DB_FORCE_RESET ? "✅ Database FORCE reset (empty)" : "✅ Database synced");
    try {
      await migrateExpatFields(sequelize);
    } catch (err) {
      console.error("[migrate] expat fields:", err.message || err);
      throw err;
    }
    try {
      await migrateGoogleAuth(sequelize);
    } catch (err) {
      console.error("[migrate] google auth:", err.message || err);
      throw err;
    }
    try {
      await seedForumSpacesIfEmpty();
    } catch (err) {
      console.warn("[seed] forum spaces:", err.message);
    }
    try {
      initEmailTransport();
    } catch (err) {
      console.error("[boot] email init failed:", err.message || err);
      throw err;
    }
    if (firebaseEnvSet()) {
      const firebaseReady = initFirebaseAdmin();
      console.log(
        "[firebase]",
        firebaseReady
          ? "FIREBASE_SERVICE_ACCOUNT_JSON set — Google sign-in enabled"
          : "FIREBASE_SERVICE_ACCOUNT_JSON set but invalid — check logs above"
      );
    } else {
      console.warn(
        "[firebase] FIREBASE_SERVICE_ACCOUNT_JSON missing — Google sign-in returns 503"
      );
    }
    console.log(`[boot] about to listen on http://localhost:${port}`);
    const server = app.listen(port, () => {
      console.log(`[port] Backend listening on http://localhost:${port}`);
      console.log("[health] JSON /health ready");
      console.log(
        "[auth] /api/auth mounted (verify, resend, forgot-password, reset-password); /api/admin (promote, purge)"
      );
    });
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(
          `❌ Port ${port} is already in use (often the React dev server on 3001).`
        );
        console.error(
          `   Option A: npm run prestart   (or: lsof -ti:${port} | xargs kill -9) then restart.`
        );
        console.error(
          "   Option B: PORT=3002 npm start and set REACT_APP_API_URL=http://localhost:3002 in frontend/.env"
        );
        process.exit(1);
      }
      throw err;
    });
  })
  .catch((err) => {
    console.error("❌ DB sync error:", err);
    console.error(
      'If SQLite reports missing *_backup: run node scripts/reset-db.js then restart (removes backend/expal.db* and rebuilds schema).'
    );
    process.exit(1);
  });


