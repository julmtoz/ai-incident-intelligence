import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ parse: vi.fn() }));

vi.mock("openai", () => ({
  default: class OpenAIMock {
    responses = { parse: mocks.parse };
  },
}));
vi.mock("../config.js", () => ({
  env: { OPENAI_API_KEY: "test-key" },
}));

import { openAIIncidentAnalysisProvider } from "./incident-analysis.js";

describe("OpenAI incident analysis provider", () => {
  beforeEach(() => mocks.parse.mockReset());

  it("returns a structured incident analysis", async () => {
    const analysis = {
      severity: "HIGH",
      category: "Database",
      rootCause: "The database connection pool is exhausted.",
      suggestedSteps: ["Inspect pool metrics", "Restart unhealthy consumers"],
    };
    mocks.parse.mockResolvedValue({ output_parsed: analysis });

    await expect(
      openAIIncidentAnalysisProvider.analyze({
        title: "API errors",
        description: "Requests fail when database traffic increases.",
        externalContext: [
          {
            sourceType: "github_issue",
            title: "Pool timeout",
            url: "https://github.com/example/api/issues/1",
            excerpt: "Connections remain checked out.",
            repository: "example/api",
          },
        ],
      })
    ).resolves.toEqual(analysis);

    expect(mocks.parse).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-5-mini", text: { format: expect.anything() } })
    );
    expect(mocks.parse.mock.calls[0][0].input[1].content).toContain("example/api");
  });

  it("rejects a response with no parsed structured output", async () => {
    mocks.parse.mockResolvedValue({ output_parsed: null });

    await expect(
      openAIIncidentAnalysisProvider.analyze({
        title: "API errors",
        description: "Failure",
        externalContext: [],
      })
    ).rejects.toThrow("no valid structured incident analysis");
  });

  it("rejects malformed structured output", async () => {
    mocks.parse.mockResolvedValue({
      output_parsed: {
        severity: "URGENT",
        category: "Database",
        rootCause: "Unknown",
        suggestedSteps: [],
      },
    });

    await expect(
      openAIIncidentAnalysisProvider.analyze({
        title: "API errors",
        description: "Failure",
        externalContext: [],
      })
    ).rejects.toThrow();
  });
});
