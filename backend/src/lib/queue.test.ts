import { describe, expect, it, vi } from "vitest";

vi.mock("../config.js", () => ({ env: { REDIS_URL: "redis://test" } }));
vi.mock("bullmq", async (importOriginal) => {
  const actual = await importOriginal<typeof import("bullmq")>();
  return { ...actual, Queue: vi.fn() };
});

import { analysisJobOptions } from "./queue.js";

describe("analysis queue retry policy", () => {
  it("caps retries at three attempts with exponential backoff", () => {
    expect(analysisJobOptions).toMatchObject({
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
    });
  });
});
