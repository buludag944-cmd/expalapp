const jwt = require("jsonwebtoken");

/** Keep middleware/auth.js and this module on the same secret (override via JWT_SECRET in prod). */
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

function issueAuthTokenPayload(user) {
  const isAdmin = !!user.isAdmin;
  const token = jwt.sign(
    { id: user.id, email: user.email, isAdmin },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
  return {
    token,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      isAdmin,
      nationality: user.nationality,
      currentCity: user.currentCity,
      destinationCountry: user.destinationCountry,
      destinationCity: user.destinationCity,
      arrivalDate: user.arrivalDate,
      moveDate: user.moveDate,
      phase: user.phase || "relocation",
      onboardingComplete: !!user.onboardingComplete,
      profession: user.profession,
      professionCategory: user.professionCategory,
      lifeAbroadScore: user.lifeAbroadScore || 0,
    },
  };
}

module.exports = { JWT_SECRET, issueAuthTokenPayload };
