/**
 * Shared Firebase Admin (push + Google sign-in token verification).
 * Set FIREBASE_SERVICE_ACCOUNT_JSON on Render (one-line service account JSON).
 */
let firebaseAdmin = null;
let initAttempted = false;

function isConfigured() {
  return !!(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
}

function getAdmin() {
  if (!isConfigured()) return null;
  if (firebaseAdmin) return firebaseAdmin;

  if (!initAttempted) {
    initAttempted = true;
    try {
      const admin = require("firebase-admin");
      if (!admin.apps.length) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON.trim());
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      }
      firebaseAdmin = admin;
      console.log("[firebase] Admin SDK ready");
    } catch (err) {
      console.error("[firebase] Admin init failed:", err.message || err);
      firebaseAdmin = null;
    }
  }

  return firebaseAdmin;
}

async function verifyIdToken(idToken) {
  const admin = getAdmin();
  if (!admin) {
    const err = new Error("Firebase is not configured on the server.");
    err.code = "FIREBASE_NOT_CONFIGURED";
    throw err;
  }
  return admin.auth().verifyIdToken(idToken);
}

module.exports = { isConfigured, getAdmin, verifyIdToken };
