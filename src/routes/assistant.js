const express = require("express");
const { User } = require("../bootstrapModels");
const { verifyToken } = require("../middleware/auth");
const { getAssistantReply } = require("../lib/expalAssistant");

const router = express.Router();
router.use(verifyToken);

router.post("/chat", async (req, res) => {
  try {
    const message = (req.body.message ?? "").toString().trim();
    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }
    const history = Array.isArray(req.body.history) ? req.body.history : [];
    const user = await User.findByPk(req.user.id, {
      attributes: [
        "id",
        "firstName",
        "lastName",
        "phase",
        "destinationCity",
        "destinationCountry",
        "profession",
        "visaType",
      ],
    });
    const { reply, source, openaiError } = await getAssistantReply(message, user, history);
    res.json({ reply, source, openaiError: openaiError || null });
  } catch (err) {
    console.error("[assistant] chat error:", err.message || err);
    res.status(500).json({ error: "Assistant is temporarily unavailable." });
  }
});

module.exports = router;
