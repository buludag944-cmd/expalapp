const express = require("express");
const router = express.Router();
// Model lives in ../models/Event (singular file + export matches Sequelize model name Event)
const Event = require("../models/Event");

// Create new event (JSON body relies on express.json() mounted earlier in server.js)
router.post("/", async (req, res) => {
  try {
    const { title, description, date, location, createdBy } = req.body;

    if (!title || !description || !date || !location || createdBy == null || createdBy === "") {
      return res.status(400).json({ error: "All fields are required." });
    }

    const event = await Event.create({
      title,
      description,
      date: new Date(date),
      location,
      createdBy: Number(createdBy),
    });
    res.status(201).json(event);
  } catch (err) {
    console.error("EVENT CREATE ERROR:", err);
    res.status(500).json({ error: "Server error creating event." });
  }
});

// List events (soonest first)
router.get("/", async (req, res) => {
  try {
    const events = await Event.findAll({ order: [["date", "ASC"]] });
    res.status(200).json(events);
  } catch (err) {
    console.error("FETCH EVENTS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch events." });
  }
});

module.exports = router;
