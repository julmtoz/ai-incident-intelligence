import { Worker } from "bullmq";
import { env } from "../config.js";
import { db } from "./db.js";

export function startWorker() {
  const worker = new Worker(
    "analysis",
    async (job) => {
      const { incidentId, jobId } = job.data as {
        incidentId: string;
        jobId: string;
      };

      await db.analysisJob.update({
        where: { id: jobId },
        data: { status: "PROCESSING", startedAt: new Date(), attempts: { increment: 1 } },
      });

      // M3: AI analysis + GitHub context lookup goes here.

      await db.analysisJob.update({
        where: { id: jobId },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
    },
    {
      connection: { url: env.REDIS_URL },
      concurrency: 5,
    }
  );

  worker.on("failed", async (job, err) => {
    if (!job) return;
    const { jobId } = job.data as { jobId: string };
    await db.analysisJob
      .update({
        where: { id: jobId },
        data: { status: "FAILED", error: err.message, completedAt: new Date() },
      })
      .catch(() => {});
  });

  return worker;
}
