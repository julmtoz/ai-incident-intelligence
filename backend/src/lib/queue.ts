import { Queue } from "bullmq";
import { env } from "../config.js";

export const analysisQueue = new Queue("analysis", {
  connection: { url: env.REDIS_URL },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});
