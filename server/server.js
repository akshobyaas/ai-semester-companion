require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const { connectDB } = require("./src/config/db");

const app = express();
const PORT = process.env.PORT || 8000;
const APP_NAME = process.env.APP_NAME || "AI Learning Engine"; // matches core/config.py's real default, not the README's "AI Semester Companion" marketing name

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*", credentials: true }));
app.use(express.json({ limit: "1mb" })); // explicit limit — file uploads go through multer separately, not this body parser
app.use(morgan("dev"));

// Health check — mirrors GET /api/health from the FastAPI app
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", app: APP_NAME, version: "1.0.0" });
});

// Route modules
app.use("/api/v1/auth", require("./src/routes/auth.routes"));
app.use("/api/v1/ingestion", require("./src/routes/ingestion.routes"));
app.use("/api/v1/learning", require("./src/routes/learning.routes"));
app.use("/api/v1/adaptive", require("./src/routes/adaptive.routes"));
app.use("/api/v1/quiz", require("./src/routes/quiz.routes"));
app.use("/api/v1/flashcards", require("./src/routes/flashcard.routes"));
app.use("/api/v1/revision", require("./src/routes/revision.routes"));
app.use("/api/v1/users", require("./src/routes/users.routes"));

// 404 for any unmatched API route — without this, Express falls through to
// its default HTML error page, which is unhelpful for a JSON API and was
// missing entirely before this phase.
app.use((req, res) => {
  res.status(404).json({ detail: `Not found: ${req.method} ${req.originalUrl}` });
});

/**
 * Global error handler. Distinguishes the error classes that actually show
 * up in practice, rather than flattening everything to a bare 500:
 *   - Malformed JSON body (express.json() throws a SyntaxError with a
 *     `.status`/`.statusCode` of 400 before ever reaching a route handler)
 *   - Mongoose ValidationError (schema validation failure — e.g. hitting a
 *     model's required/enum rules directly, bypassing a route's own checks)
 *   - Mongoose CastError (a malformed ObjectId reaching a query) — several
 *     routes already guard this locally with `.catch(() => null)`, but this
 *     is the backstop for any that don't.
 *   - Everything else falls through to a generic 500, matching the
 *     single generic handler this replaced.
 */
app.use((err, req, res, next) => {
  console.error(err);

  if (err.type === "entity.parse.failed" || err instanceof SyntaxError) {
    return res.status(400).json({ detail: "Malformed JSON in request body" });
  }

  if (err.name === "ValidationError") {
    const fields = Object.keys(err.errors || {});
    return res.status(422).json({ detail: `Validation failed: ${fields.join(", ")}` });
  }

  if (err.name === "CastError") {
    return res.status(400).json({ detail: `Invalid ID format: ${err.value}` });
  }

  return res.status(err.status || 500).json({ detail: err.message || "Internal server error" });
});

async function start() {
  const maxRetries = 10;
  let attempt = 0;

  // Retry loop so the server container doesn't crash-loop while
  // waiting for the mongo container to finish initializing.
  while (attempt < maxRetries) {
    try {
      await connectDB();
      break;
    } catch (err) {
      attempt += 1;
      console.warn(`[db] connection attempt ${attempt}/${maxRetries} failed: ${err.message}`);
      if (attempt >= maxRetries) {
        console.error("[db] could not connect to MongoDB, exiting");
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[server] ${APP_NAME} listening on port ${PORT}`);
  });
}

if (require.main === module) {
  start();
}

module.exports = app;
