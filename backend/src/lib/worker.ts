import { Job, Worker } from "bullmq";
import { env } from "../config.js";
import {
  IncidentAnalysisProvider,
  openAIIncidentAnalysisProvider,
} from "../services/incident-analysis.js";
import { db } from "./db.js";

type AnalysisJobData = { incidentId: string; jobId: string };

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown analysis error";
  return message.slice(0, 2000);
}

export function createAnalysisProcessor(
  provider: IncidentAnalysisProvider = openAIIncidentAnalysisProvider
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
    const analysis = await provider.analyze(incident);

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
