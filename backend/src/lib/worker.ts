import { Job, Worker } from "bullmq";
import { env } from "../config.js";
import {
  IncidentAnalysisProvider,
  openAIIncidentAnalysisProvider,
} from "../services/incident-analysis.js";
import {
  GitHubContextProvider,
  githubContextProvider,
} from "../services/github-context.js";
import type { ExternalContextItem } from "../services/github-context.js";
import { db } from "./db.js";
import { analysisQueue } from "./queue.js";

type AnalysisJobData = { incidentId: string; jobId: string };

type SanitizedAnalysisError = {
  category: string;
  message: string;
  status?: number;
  code?: string;
  type?: string;
  requestId?: string;
};

function sanitizedString(value: unknown, maxLength: number) {
  if (typeof value !== "string" || value.length === 0) return undefined;
  return value
    .replace(/\bsk-[A-Za-z0-9_-]+\b/g, "[REDACTED]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/\bapi[_-]?key\s*[:=]\s*\S+/gi, "api_key=[REDACTED]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeAnalysisError(error: unknown): SanitizedAnalysisError {
  const candidate = typeof error === "object" && error !== null
    ? error as Record<string, unknown>
    : undefined;
  const category = sanitizedString(
    error instanceof Error ? error.constructor.name : undefined,
    80
  ) ?? "UnknownAnalysisError";
  const message = sanitizedString(error instanceof Error ? error.message : undefined, 500)
    ?? "Unknown analysis error";
  const status = typeof candidate?.status === "number" ? candidate.status : undefined;
  const code = sanitizedString(candidate?.code, 120);
  const type = sanitizedString(candidate?.type, 120);
  const requestId = sanitizedString(candidate?.request_id, 120);

  return { category, message, status, code, type, requestId };
}

function safeErrorMessage(error: unknown) {
  const diagnostic = sanitizeAnalysisError(error);
  const metadata = [
    diagnostic.status === undefined ? undefined : `status=${diagnostic.status}`,
    diagnostic.code ? `code=${diagnostic.code}` : undefined,
    diagnostic.type ? `type=${diagnostic.type}` : undefined,
  ].filter(Boolean);
  const prefix = metadata.length > 0
    ? `${diagnostic.category} (${metadata.join(", ")})`
    : diagnostic.category;
  return `${prefix}: ${diagnostic.message}`.slice(0, 2000);
}

export function createAnalysisProcessor(
  provider: IncidentAnalysisProvider = openAIIncidentAnalysisProvider,
  contextProvider: GitHubContextProvider = githubContextProvider
) {
  return async (job: Job<AnalysisJobData>) => {
    const { incidentId, jobId } = job.data;

    await db.analysisJob.update({
      where: { id: jobId },
      data: {
        status: "PROCESSING",
        startedAt: job.attemptsMade === 0 ? new Date() : undefined,
        completedAt: null,
        error: null,
        attempts: { increment: 1 },
      },
    });

    const incident = await db.incident.findUniqueOrThrow({
      where: { id: incidentId },
      select: { title: true, description: true },
    });
    let externalContext: ExternalContextItem[] = [];
    try {
      externalContext = await contextProvider.findRelevant(incident);
    } catch (error) {
      const diagnostic = error instanceof Error ? error.message : "Unknown GitHub lookup error";
      console.warn(`GitHub context unavailable; continuing without it: ${diagnostic.slice(0, 500)}`);
    }
    const analysis = await provider.analyze({ ...incident, externalContext });

    await db.$transaction(async (transaction) => {
      await transaction.incident.update({
        where: { id: incidentId },
        data: { severity: analysis.severity, category: analysis.category },
      });
      await transaction.analysisJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          rootCause: analysis.rootCause,
          suggestedSteps: JSON.stringify(analysis.suggestedSteps),
          externalContext,
          error: null,
          completedAt: new Date(),
        },
      });
    });
  };
}

export async function recordAnalysisFailure(
  job: Job<AnalysisJobData> | undefined,
  error: unknown
) {
  if (!job) return;

  const maxAttempts = job.opts.attempts ?? 1;
  const isTerminal = job.attemptsMade >= maxAttempts;
  const diagnostic = sanitizeAnalysisError(error);
  console.error(
    "Analysis attempt failed",
    JSON.stringify({
      jobId: job.data.jobId,
      incidentId: job.data.incidentId,
      attempt: job.attemptsMade,
      maxAttempts,
      terminal: isTerminal,
      ...diagnostic,
    })
  );
  await db.analysisJob.update({
    where: { id: job.data.jobId },
    data: isTerminal
      ? {
          status: "FAILED",
          error: safeErrorMessage(error),
          completedAt: new Date(),
        }
      : {
          status: "QUEUED",
          error: safeErrorMessage(error),
          completedAt: null,
        },
  });
}

export function startWorker() {
  const worker = new Worker(
    "analysis",
    createAnalysisProcessor(),
    {
      connection: { url: env.REDIS_URL },
      concurrency: 5,
    }
  );

  worker.on("failed", (job, error) => {
    void recordAnalysisFailure(job, error).catch((persistenceError) => {
      console.error("Failed to persist analysis job failure", persistenceError);
    });
  });

  return worker;
}

export async function recoverIncompleteAnalysisJobs() {
  const incompleteJobs = await db.analysisJob.findMany({
    where: { status: { in: ["QUEUED", "PROCESSING"] } },
    select: { id: true, incidentId: true, status: true },
  });

  for (const job of incompleteJobs) {
    if (job.status === "PROCESSING") {
      await db.analysisJob.update({
        where: { id: job.id },
        data: { status: "QUEUED", completedAt: null },
      });
    }
    await analysisQueue.add(
      "analyse",
      { incidentId: job.incidentId, jobId: job.id },
      { jobId: job.id }
    );
  }

  return incompleteJobs.length;
}
