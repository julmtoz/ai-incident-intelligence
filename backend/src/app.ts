import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import path from "node:path";
import { env } from "./config.js";
import { db } from "./lib/db.js";
import { pingRedis } from "./lib/queue.js";
import incidentsRouter from "./routes/incidents.js";

export const app = express();

app.disable("x-powered-by");
if (env.TRUST_PROXY) app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
if (env.FRONTEND_URL) app.use(cors({ origin: env.FRONTEND_URL }));
app.use(express.json({ limit: env.BODY_LIMIT, strict: true }));

const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again shortly." },
});
const submissionLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.SUBMISSION_RATE_LIMIT_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many incident submissions. Please try again shortly." },
});

app.get("/health/live", (_req, res) => {
  res.status(200).json({ status: "live" });
});

app.get("/health/ready", async (_req, res) => {
  try {
    await Promise.all([db.$queryRaw`SELECT 1`, pingRedis()]);
    res.status(200).json({ status: "ready", dependencies: { postgres: "up", redis: "up" } });
  } catch {
    res.status(503).json({ status: "not-ready" });
  }
});

app.use("/api", apiLimiter);
app.post("/api/incidents", submissionLimiter);
app.use("/api/incidents", incidentsRouter);

if (env.NODE_ENV === "production") {
  const staticDirectory = path.resolve(env.STATIC_DIR);
  app.use(express.static(staticDirectory, { index: false, maxAge: "1h" }));
  app.get("/{*splat}", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/health/")) return next();
    res.sendFile(path.join(staticDirectory, "index.html"));
  });
}

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  void _next;
  if (typeof error === "object" && error !== null && "type" in error && error.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large" });
  }
  if (error instanceof SyntaxError) return res.status(400).json({ error: "Invalid JSON request body" });
  console.error("Unhandled request error", error instanceof Error ? error.message : "Unknown error");
  res.status(500).json({ error: "Internal server error" });
});
