import { Router } from "express";
import { z } from "zod";
import { db } from "../lib/db.js";
import { analysisQueue } from "../lib/queue.js";

const router = Router();

const createIncidentSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(5000),
}).strict();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

const incidentParamsSchema = z.object({ id: z.string().uuid() });

function sanitizeIncident<T extends { jobs: Array<{ status: string; error: string | null }> }>(
  incident: T
) {
  return {
    ...incident,
    jobs: incident.jobs.map((job) => ({
      ...job,
      error: job.status === "FAILED" ? "Analysis failed after retry attempts." : null,
    })),
  };
}

// POST /api/incidents — create an incident record and enqueue analysis.
router.post("/", async (req, res) => {
  const parsed = createIncidentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { incident, analysisJob } = await db.$transaction(async (transaction) => {
    const incident = await transaction.incident.create({ data: parsed.data });
    const analysisJob = await transaction.analysisJob.create({
      data: { incidentId: incident.id, status: "QUEUED" },
    });
    return { incident, analysisJob };
  });

  try {
    await analysisQueue.add(
      "analyse",
      { incidentId: incident.id, jobId: analysisJob.id },
      { jobId: analysisJob.id }
    );
  } catch {
    await db.analysisJob.update({
      where: { id: analysisJob.id },
      data: {
        status: "FAILED",
        error: "The analysis queue is temporarily unavailable.",
        completedAt: new Date(),
      },
    });
    return res.status(503).json({ error: "Analysis is temporarily unavailable. Please try again." });
  }

  res.status(201).json(sanitizeIncident({ ...incident, jobs: [analysisJob] }));
});

// GET /api/incidents — paginated list, newest first.
router.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid pagination parameters" });
  const { page, pageSize } = parsed.data;

  const [items, total] = await Promise.all([
    db.incident.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { jobs: true },
    }),
    db.incident.count(),
  ]);

  res.json({ items: items.map(sanitizeIncident), total, page, pageSize });
});

// GET /api/incidents/:id — single incident with its job history.
router.get("/:id", async (req, res) => {
  const parsed = incidentParamsSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid incident identifier" });
  const incident = await db.incident.findUnique({
    where: { id: parsed.data.id },
    include: { jobs: true },
  });

  if (!incident) {
    return res.status(404).json({ error: "Incident not found" });
  }

  res.json(sanitizeIncident(incident));
});

export default router;
