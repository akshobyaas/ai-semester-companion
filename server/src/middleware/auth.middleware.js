const jwt = require("jsonwebtoken");
const { User } = require("../models");
const { JWT_SECRET } = require("../auth/security");

/**
 * Ports get_current_user(). FastAPI raises 401 with WWW-Authenticate: Bearer
 * on: missing/malformed token, invalid signature, missing "sub" claim, or
 * user no longer existing. All four cases map to the same response here,
 * matching the Python version's "credentials_exception" reuse.
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return unauthorized(res);
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return unauthorized(res);
  }

  const userId = payload.sub;
  if (!userId) {
    return unauthorized(res);
  }

  const user = await User.findById(userId).catch(() => null);
  if (!user) {
    return unauthorized(res);
  }

  req.user = user;
  next();
}

function unauthorized(res) {
  res.set("WWW-Authenticate", "Bearer");
  return res.status(401).json({ detail: "Could not validate credentials" });
}

module.exports = { requireAuth };
