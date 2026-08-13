import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config.js";
import { db } from "./lib/db.js";
import incidentsRouter from "./routes/incidents.js";

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_URL,
  })
);
app.use(express.json());

app.get("/health/live", (_req, res) => {
  res.status(200).json({ status: "live" });
});

app.get("/health/ready", async (_req, res) => {
  try {
    await db.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "not-ready" });
  }
});

app.use("/api/incidents", incidentsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});
