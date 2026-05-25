const { User } = require("../bootstrapModels");

/** Server-side admin check — JWT isAdmin is not trusted for authorization. */
async function requireAdmin(req, res, next) {
  try {
    const actorId = req.user?.id;
    if (!actorId) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const actor = await User.findByPk(actorId);
    if (!actor || !actor.isAdmin) {
      return res.status(403).json({ error: "Admin only" });
    }

    req.adminUser = actor;
    return next();
  } catch (err) {
    console.error("[admin] requireAdmin error:", err.message || err);
    return res.status(500).json({ error: "Authorization check failed." });
  }
}

/**
 * Bootstrap: when no admins exist, any authenticated user may call POST /promote once.
 * Runbook: log in → POST /api/admin/promote { email } → then only admins can purge.
 */
async function requireAdminOrBootstrap(req, res, next) {
  try {
    const adminCount = await User.count({ where: { isAdmin: true } });
    if (adminCount === 0) {
      return next();
    }
    return requireAdmin(req, res, next);
  } catch (err) {
    console.error("[admin] requireAdminOrBootstrap error:", err.message || err);
    return res.status(500).json({ error: "Authorization check failed." });
  }
}

module.exports = { requireAdmin, requireAdminOrBootstrap };
