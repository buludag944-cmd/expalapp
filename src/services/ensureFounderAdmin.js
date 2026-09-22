/**
 * On boot, promote the support/founder email to isAdmin if the user row exists.
 * Safe to run every start — no-op when missing or already admin.
 */
const { fn, col, where } = require("sequelize");
const { User } = require("../bootstrapModels");

const FOUNDER_EMAIL = "expalappsupport@gmail.com";

async function ensureFounderAdmin() {
  const email = FOUNDER_EMAIL.toLowerCase();
  const user = await User.findOne({
    where: where(fn("lower", col("email")), email),
  });

  if (!user) {
    console.log(
      `[admin] founder ${email} not found yet — sign in once, then restart to grant isAdmin`
    );
    return { promoted: false, reason: "missing" };
  }

  if (user.isAdmin) {
    return { promoted: false, reason: "already_admin", userId: user.id };
  }

  user.isAdmin = true;
  await user.save();
  console.log(`[admin] promoted founder ${email} userId=${user.id} to isAdmin`);
  return { promoted: true, userId: user.id };
}

module.exports = { ensureFounderAdmin, FOUNDER_EMAIL };
