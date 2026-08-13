import { z } from "zod";
import { env } from "../config.js";

const MAX_RESULTS = 3;
const MAX_EXCERPT_LENGTH = 300;
const SEARCH_TIMEOUT_MS = 8_000;

const githubSearchResponseSchema = z.object({
  items: z.array(
    z.object({
      title: z.string(),
      html_url: z.string().url(),
      body: z.string().nullable(),
      repository_url: z.string(),
    })
  ),
});

export type ExternalContextItem = {
  sourceType: "github_issue";
  title: string;
  url: string;
  excerpt: string;
  repository: string;
};

export interface GitHubContextProvider {
  findRelevant(input: { title: string; description: string }): Promise<ExternalContextItem[]>;
}

const stopWords = new Set([
  "after",
  "all",
  "and",
  "are",
  "been",
  "from",
  "have",
  "into",
  "requests",
  "return",
  "that",
  "the",
  "this",
  "when",
  "with",
]);

export function deriveGitHubSearchQuery(title: string, description: string) {
  const terms = `${title} ${description}`
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9_.-]{2,}/g)
    ?.filter((term, index, values) => !stopWords.has(term) && values.indexOf(term) === index)
    .slice(0, 8);

  return `${terms?.join(" ") || title.slice(0, 80)} is:issue`;
}

function repositoryName(repositoryUrl: string) {
  return repositoryUrl.split("/repos/")[1] ?? "unknown";
}

function compactExcerpt(body: string | null) {
  return (body ?? "No issue description provided.")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_EXCERPT_LENGTH);
}

export const githubContextProvider: GitHubContextProvider = {
  async findRelevant({ title, description }) {
    const url = new URL("https://api.github.com/search/issues");
    url.searchParams.set("q", deriveGitHubSearchQuery(title, description));
    url.searchParams.set("sort", "updated");
    url.searchParams.set("order", "desc");
    url.searchParams.set("per_page", String(MAX_RESULTS));

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "ai-incident-intelligence",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;

    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`GitHub issue search failed with status ${response.status}`);
    }

    const parsed = githubSearchResponseSchema.parse(await response.json());
    return parsed.items.slice(0, MAX_RESULTS).map((item) => ({
      sourceType: "github_issue" as const,
      title: item.title.slice(0, 200),
      url: item.html_url,
      excerpt: compactExcerpt(item.body),
      repository: repositoryName(item.repository_url),
    }));
  },
};
