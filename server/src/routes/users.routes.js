const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const { verifyPassword, getPasswordHash } = require("../auth/security");

const router = express.Router();

/**
 * NEW IN PHASE 18 (by explicit request): the legacy settings feature
 * covers university/theme/notification preferences with no equivalent
 * anywhere in the app/ backend to port from — there's no "Settings" model
 * at all in the canonical source. Rather than invent a preferences schema
 * from nothing, this is scoped to what's real and backed by an actual
 * model: updating the User's own full_name, and changing password with
 * the same bcrypt verify/hash flow as auth.routes.js's register/login.
 */

// PUT /users/me — update profile (currently just full_name; email intentionally
// not editable here to avoid duplicating auth.routes.js's uniqueness handling)
router.put("/me", requireAuth, async (req, res, next) => {
  try {
    const { full_name: fullName } = req.body;
    if (!fullName || fullName.length < 2) {
      return res.status(422).json({ detail: "full_name must be at least 2 characters" });
    }

    req.user.fullName = fullName;
    await req.user.save();

    return res.json({
      id: req.user._id,
      email: req.user.email,
      full_name: req.user.fullName,
      role: req.user.role,
      is_active: req.user.isActive,
      created_at: req.user.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /users/me/password — change password
router.put("/me/password", requireAuth, async (req, res, next) => {
  try {
    const { current_password: currentPassword, new_password: newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(422).json({ detail: "current_password and new_password are required" });
    }
    if (newPassword.length < 8) {
      return res.status(422).json({ detail: "new_password must be at least 8 characters" });
    }

    const valid = await verifyPassword(currentPassword, req.user.hashedPassword);
    if (!valid) {
      return res.status(401).json({ detail: "Current password is incorrect" });
    }

    req.user.hashedPassword = await getPasswordHash(newPassword);
    await req.user.save();

    return res.json({ detail: "Password updated" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
