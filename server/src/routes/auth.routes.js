const express = require("express");
const { User } = require("../models");
const { getPasswordHash, createAccessToken, authenticateUser } = require("../auth/security");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

// POST /auth/register
router.post("/register", async (req, res, next) => {
  try {
    const { email, password, full_name: fullName } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(422).json({ detail: "email is required" });
    }
    if (!password || password.length < 8) {
      return res.status(422).json({ detail: "password must be at least 8 characters" });
    }
    if (!fullName || fullName.length < 2) {
      return res.status(422).json({ detail: "full_name must be at least 2 characters" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ detail: "Email already registered" });
    }

    const user = await User.create({
      email,
      hashedPassword: await getPasswordHash(password),
      fullName,
    });

    return res.status(201).json({
      id: user._id,
      email: user.email,
      full_name: user.fullName,
      role: user.role,
      is_active: user.isActive,
      created_at: user.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/login
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(422).json({ detail: "email and password are required" });
    }

    const user = await authenticateUser(email, password);
    if (!user) {
      res.set("WWW-Authenticate", "Bearer");
      return res.status(401).json({ detail: "Incorrect email or password" });
    }

    const accessToken = createAccessToken({ sub: user._id.toString() });
    return res.json({ access_token: accessToken, token_type: "bearer" });
  } catch (err) {
    next(err);
  }
});

// GET /auth/me
router.get("/me", requireAuth, (req, res) => {
  const user = req.user;
  return res.json({
    id: user._id,
    email: user.email,
    full_name: user.fullName,
    role: user.role,
    is_active: user.isActive,
    created_at: user.createdAt,
  });
});

module.exports = router;
