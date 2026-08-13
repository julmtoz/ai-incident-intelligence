import { Router } from "express";
import { z } from "zod";
import { db } from "../lib/db.js";
import { analysisQueue } from "../lib/queue.js";

const router = Router();

const createIncidentSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
});

// POST /api/incidents — create an incident record and enqueue analysis.
router.post("/", async (req, res) => {
  const parsed = createIncidentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const incident = await db.incident.create({ data: parsed.data });

  const analysisJob = await db.analysisJob.create({
    data: { incidentId: incident.id, status: "QUEUED" },
  });

  await analysisQueue.add("analyse", {
    incidentId: incident.id,
    jobId: analysisJob.id,
  });

  res.status(201).json({ ...incident, jobs: [analysisJob] });
});

// GET /api/incidents — paginated list, newest first.
router.get("/", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Number(req.query.pageSize) || 20);

  const [items, total] = await Promise.all([
    db.incident.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { jobs: true },
    }),
    db.incident.count(),
  ]);

  res.json({ items, total, page, pageSize });
});

// GET /api/incidents/:id — single incident with its job history.
router.get("/:id", async (req, res) => {
  const incident = await db.incident.findUnique({
    where: { id: req.params.id },
    include: { jobs: true },
  });

  if (!incident) {
    return res.status(404).json({ error: "Incident not found" });
  }

  res.json(incident);
});

export default router;
