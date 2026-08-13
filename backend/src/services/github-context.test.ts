import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config.js", () => ({ env: { GITHUB_TOKEN: undefined } }));

import { deriveGitHubSearchQuery, githubContextProvider } from "./github-context.js";

describe("GitHub context provider", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("derives a concise technical issue query", () => {
    const query = deriveGitHubSearchQuery(
      "PostgreSQL connection timeout",
      "API requests fail after the database pool is exhausted"
    );

    expect(query).toBe(
      "postgresql connection timeout api fail database pool exhausted is:issue"
    );
  });

  it("normalizes and bounds successful issue results", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              title: "Pool exhaustion causes timeouts",
              html_url: "https://github.com/example/service/issues/42",
              body: "Connections   are not released.\nInspect pool metrics.",
              repository_url: "https://api.github.com/repos/example/service",
            },
          ],
        }),
        { status: 200 }
      )
    );

    await expect(
      githubContextProvider.findRelevant({ title: "DB timeout", description: "Pool exhausted" })
    ).resolves.toEqual([
      {
        sourceType: "github_issue",
        title: "Pool exhaustion causes timeouts",
        url: "https://github.com/example/service/issues/42",
        excerpt: "Connections are not released. Inspect pool metrics.",
        repository: "example/service",
      },
    ]);
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({ search: expect.stringContaining("per_page=3") }),
      expect.objectContaining({
        headers: expect.not.objectContaining({ Authorization: expect.anything() }),
      })
    );
  });

  it("returns an empty array for an empty search", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), { status: 200 })
    );

    await expect(
      githubContextProvider.findRelevant({ title: "Unknown", description: "No matches" })
    ).resolves.toEqual([]);
  });

  it("throws a safe error for a failed GitHub response", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("secret response body", { status: 403 }));

    await expect(
      githubContextProvider.findRelevant({ title: "DB timeout", description: "Pool exhausted" })
    ).rejects.toThrow("GitHub issue search failed with status 403");
  });
});
