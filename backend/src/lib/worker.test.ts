import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  analysisJobUpdate: vi.fn(),
  incidentFind: vi.fn(),
  incidentUpdate: vi.fn(),
  transactionAnalysisJobUpdate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../config.js", () => ({ env: { REDIS_URL: "redis://test" } }));
vi.mock("../services/incident-analysis.js", () => ({
  openAIIncidentAnalysisProvider: { analyze: vi.fn() },
}));
vi.mock("../services/github-context.js", () => ({
  githubContextProvider: { findRelevant: vi.fn().mockResolvedValue([]) },
}));
vi.mock("./db.js", () => ({
  db: {
    analysisJob: { update: mocks.analysisJobUpdate },
    incident: { findUniqueOrThrow: mocks.incidentFind },
    $transaction: mocks.transaction,
  },
}));

import { createAnalysisProcessor, recordAnalysisFailure } from "./worker.js";

function makeJob(attemptsMade = 0, attempts = 3) {
  return {
    data: { incidentId: "incident-1", jobId: "job-1" },
    attemptsMade,
    opts: { attempts },
  } as Job<{ incidentId: string; jobId: string }>;
}

describe("analysis worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.analysisJobUpdate.mockResolvedValue({});
    mocks.incidentFind.mockResolvedValue({
      title: "Checkout outage",
      description: "All checkout requests return HTTP 503.",
    });
    mocks.incidentUpdate.mockResolvedValue({});
    mocks.transactionAnalysisJobUpdate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        incident: { update: mocks.incidentUpdate },
        analysisJob: { update: mocks.transactionAnalysisJobUpdate },
      })
    );
  });

  it("persists structured analysis and completes the job", async () => {
    const provider = {
      analyze: vi.fn().mockResolvedValue({
        severity: "CRITICAL" as const,
        category: "Availability",
        rootCause: "The checkout upstream is unavailable.",
        suggestedSteps: ["Inspect upstream health", "Fail over traffic"],
      }),
    };

    const context = [
      {
        sourceType: "github_issue" as const,
        title: "Similar checkout outage",
        url: "https://github.com/example/checkout/issues/7",
        excerpt: "Upstream health checks failed.",
        repository: "example/checkout",
      },
    ];
    const contextProvider = { findRelevant: vi.fn().mockResolvedValue(context) };

    await createAnalysisProcessor(provider, contextProvider)(makeJob());

    expect(provider.analyze).toHaveBeenCalledWith({
      title: "Checkout outage",
      description: "All checkout requests return HTTP 503.",
      externalContext: context,
    });
    expect(mocks.incidentUpdate).toHaveBeenCalledWith({
      where: { id: "incident-1" },
      data: { severity: "CRITICAL", category: "Availability" },
    });
    expect(mocks.transactionAnalysisJobUpdate).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: expect.objectContaining({
        status: "COMPLETED",
        rootCause: "The checkout upstream is unavailable.",
        suggestedSteps: JSON.stringify(["Inspect upstream health", "Fail over traffic"]),
        externalContext: context,
        completedAt: expect.any(Date),
      }),
    });
  });

  it("continues incident-only analysis when GitHub lookup fails", async () => {
    const provider = {
      analyze: vi.fn().mockResolvedValue({
        severity: "HIGH" as const,
        category: "Availability",
        rootCause: "The upstream is unavailable.",
        suggestedSteps: ["Inspect upstream health"],
      }),
    };
    const contextProvider = {
      findRelevant: vi.fn().mockRejectedValue(new Error("GitHub rate limited")),
    };
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await createAnalysisProcessor(provider, contextProvider)(makeJob());

    expect(provider.analyze).toHaveBeenCalledWith(
      expect.objectContaining({ externalContext: [] })
    );
    expect(mocks.transactionAnalysisJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ externalContext: [] }) })
    );
    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining("GitHub context unavailable; continuing without it")
    );
    warning.mockRestore();
  });

  it("propagates provider failures so BullMQ can retry", async () => {
    const provider = { analyze: vi.fn().mockRejectedValue(new Error("OpenAI timed out")) };

    await expect(createAnalysisProcessor(provider)(makeJob())).rejects.toThrow("OpenAI timed out");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns a retrying failure to QUEUED with its error", async () => {
    await recordAnalysisFailure(makeJob(1, 3), new Error("OpenAI rate limit"));

    expect(mocks.analysisJobUpdate).toHaveBeenLastCalledWith({
      where: { id: "job-1" },
      data: { status: "QUEUED", error: "OpenAI rate limit", completedAt: null },
    });
  });

  it("records FAILED after the final attempt", async () => {
    await recordAnalysisFailure(makeJob(3, 3), new Error("OpenAI unavailable"));

    expect(mocks.analysisJobUpdate).toHaveBeenLastCalledWith({
      where: { id: "job-1" },
      data: {
        status: "FAILED",
        error: "OpenAI unavailable",
        completedAt: expect.any(Date),
      },
    });
  });

  it("preserves the original startedAt on retries", async () => {
    const provider = {
      analyze: vi.fn().mockResolvedValue({
        severity: "LOW" as const,
        category: "Other",
        rootCause: "Transient issue",
        suggestedSteps: ["Monitor"],
      }),
    };

    await createAnalysisProcessor(provider)(makeJob(1, 3));

    expect(mocks.analysisJobUpdate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: expect.objectContaining({ startedAt: undefined }) })
    );
  });
});
