const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User } = require("../models");

const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-key-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";
const BCRYPT_SALT_ROUNDS = 12; // passlib's bcrypt default is 12 rounds — matched here

async function verifyPassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

async function getPasswordHash(password) {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Ports create_access_token(data, expires_delta). Python's default expiry
 * lives in settings.access_token_expire_minutes (1440 = 1 day); the Node
 * equivalent is JWT_EXPIRES_IN, defaulted to "1d" to match.
 */
function createAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Ports authenticate_user(db, email, password): looks up by email,
 * returns null if not found OR password doesn't match — same
 * non-distinguishing failure mode as the Python version (prevents
 * user-enumeration via different error messages).
 */
async function authenticateUser(email, password) {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return null;
  const valid = await verifyPassword(password, user.hashedPassword);
  if (!valid) return null;
  return user;
}

module.exports = {
  verifyPassword,
  getPasswordHash,
  createAccessToken,
  authenticateUser,
  JWT_SECRET,
};
