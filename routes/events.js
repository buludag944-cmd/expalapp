/**
 * Thin entry so `backend/routes/events.js` resolves to the real router under `src/`.
 * Keeps imports stable if tooling expects routes next to backend root.
 */
module.exports = require("../src/routes/events");
