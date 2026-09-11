const request = require("supertest");
const mongoose = require("mongoose");

// Cold-start module loading (OpenAI client construction, mongoose, the full
// agent registry) can exceed Jest's 5s default in a constrained environment
// even though actual request handling is fast once warm — bumping this is
// a legitimate tuning need, not a workaround for a slow endpoint.
jest.setTimeout(20000);

/**
 * Ports tests/test_api.py. One deliberate upgrade, flagged rather than
 * silent: the original's assertions are tolerant of failure —
 * `assert response.status_code in [201, 500]` — because its fixture never
 * mocks the database, so it can't tell "worked correctly" from "the DB
 * wasn't there." That's a real gap in the original's test rigor, not a
 * behavior worth preserving. This version mocks the User model the same
 * way every phase's manual testing did throughout this migration, so each
 * assertion is a real pass/fail signal instead of "either outcome passes."
 */

const { User } = require("../src/models");

describe("API health and auth", () => {
  let originalFindOne, originalCreate;

  beforeEach(() => {
    originalFindOne = User.findOne;
    originalCreate = User.create;
  });

  afterEach(() => {
    User.findOne = originalFindOne;
    User.create = originalCreate;
  });

  test("health check", async () => {
    const app = require("../server");
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
    expect(res.body.app).toBe("AI Learning Engine");
  });

  test("register a new user succeeds", async () => {
    User.findOne = async () => null;
    User.create = async (data) => ({
      _id: new mongoose.Types.ObjectId(),
      email: data.email,
      fullName: data.fullName,
      role: "student",
      isActive: true,
      createdAt: new Date(),
    });

    const app = require("../server");
    const res = await request(app).post("/api/v1/auth/register").send({
      email: "test@example.com",
      password: "testpassword123",
      full_name: "Test User",
    });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe("test@example.com");
  });

  test("login with invalid credentials returns 401", async () => {
    User.findOne = async () => null;

    const app = require("../server");
    const res = await request(app).post("/api/v1/auth/login").send({
      email: "nonexistent@example.com",
      password: "wrongpassword",
    });

    expect(res.status).toBe(401);
  });

  test("protected route without auth returns 401", async () => {
    const app = require("../server");
    const res = await request(app).get("/api/v1/ingestion/courses");

    expect(res.status).toBe(401);
  });
});
