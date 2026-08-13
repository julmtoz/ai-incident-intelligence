import "dotenv/config";
import { app } from "./app.js";
import { env } from "./config.js";
import { startWorker } from "./lib/worker.js";

startWorker();

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});
