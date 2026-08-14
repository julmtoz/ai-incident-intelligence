import "dotenv/config";
import { app } from "./app.js";
import { env } from "./config.js";
import { analysisQueue } from "./lib/queue.js";
import { db } from "./lib/db.js";
import { scheduleForceExit } from "./lib/shutdown.js";
import { recoverIncompleteAnalysisJobs, startWorker } from "./lib/worker.js";

const worker = startWorker();
const recoveredJobs = await recoverIncompleteAnalysisJobs();
if (recoveredJobs) console.log(`Recovered ${recoveredJobs} incomplete analysis job(s)`);

const server = app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; shutting down gracefully`);
  server.close();
  const forceExit = scheduleForceExit();
  try {
    await worker.close();
    await analysisQueue.close();
    await db.$disconnect();
    clearTimeout(forceExit);
    process.exit(0);
  } catch (error) {
    console.error("Graceful shutdown failed", error instanceof Error ? error.message : "Unknown error");
    process.exit(1);
  }
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
