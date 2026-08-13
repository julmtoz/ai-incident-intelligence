import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ postgres: vi.fn(), redis: vi.fn() }));

vi.mock("./config.js", () => ({
  env: {
    NODE_ENV: "test",
    BODY_LIMIT: "1kb",
    RATE_LIMIT_WINDOW_MS: 60_000,
    RATE_LIMIT_MAX: 100,
    SUBMISSION_RATE_LIMIT_MAX: 100,
    TRUST_PROXY: false,
  },
}));
vi.mock("./lib/db.js", () => ({ db: { $queryRaw: mocks.postgres } }));
vi.mock("./lib/queue.js", () => ({
  pingRedis: mocks.redis,
  analysisQueue: { add: vi.fn() },
}));
vi.mock("./routes/incidents.js", async () => {
  const { Router } = await import("express");
  return { default: Router() };
});

import { app } from "./app.js";

describe("production HTTP hardening", () => {
  beforeEach(() => {
    mocks.postgres.mockResolvedValue([{ one: 1 }]);
    mocks.redis.mockResolvedValue("PONG");
  });

  it("reports both critical dependencies in readiness", async () => {
    const response = await request(app).get("/health/ready");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ready",
      dependencies: { postgres: "up", redis: "up" },
    });
  });

  it("fails readiness when Redis is unavailable", async () => {
    mocks.redis.mockRejectedValue(new Error("offline"));
    const response = await request(app).get("/health/ready");
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: "not-ready" });
  });

  it("sets security headers and hides the framework signature", async () => {
    const response = await request(app).get("/health/live");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("rejects malformed and oversized JSON safely", async () => {
    const malformed = await request(app)
      .post("/api/incidents")
      .set("Content-Type", "application/json")
      .send('{"title":');
    expect(malformed.status).toBe(400);
    expect(malformed.body).toEqual({ error: "Invalid JSON request body" });

    const oversized = await request(app)
      .post("/api/incidents")
      .send({ title: "Incident", description: "x".repeat(2000) });
    expect(oversized.status).toBe(413);
    expect(oversized.body).toEqual({ error: "Request body is too large" });
  });
});
