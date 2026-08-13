import { JobsOptions, Queue } from "bullmq";
import { env } from "../config.js";

export const analysisJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 200 },
};

export const analysisQueue = new Queue("analysis", {
  connection: { url: env.REDIS_URL },
  defaultJobOptions: analysisJobOptions,
});
