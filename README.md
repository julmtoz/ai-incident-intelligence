# AI Incident Intelligence Platform

A service that takes an IT incident report and runs it through an AI-driven
analysis pipeline: severity/category classification, root-cause summary,
suggested troubleshooting steps, and relevant external technical context —
processed asynchronously via a background job queue.

**Status: in progress.** This README is updated as milestones land, and only
describes what is actually implemented — not the full target scope.

## Milestones

- [x] **M1 — Scaffold:** repo structure, Docker Compose (Postgres + Redis),
      Prisma schema, Express API skeleton with health/readiness checks,
      incident create/list/get endpoints
- [ ] **M2 — Job pipeline:** BullMQ queue wired to Redis; submitting an
      incident enqueues a job; job status persisted and queryable
- [ ] **M3 — AI integration:** OpenAI Responses API call inside the worker —
      severity/category classification, root-cause summary, suggested steps
- [ ] **M4 — External context:** GitHub REST API lookup folded into analysis
- [ ] **M5 — Frontend:** submission form, job status/progress view, results
- [ ] **M6 — Hardening:** retry logic, tests, Docker image, CI, deployment

## Stack

- **Frontend:** React, TypeScript
- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL + Prisma
- **AI:** OpenAI Responses API
- **Background jobs:** BullMQ + Redis
- **External API:** GitHub REST API
- **Validation:** Zod
- **Testing:** Vitest + Supertest
- **Containers:** Docker Compose
- **Deployment:** Render (planned)

## Local setup (current M1 scope)

Prerequisites: Node.js 20+, npm, Docker Desktop.

```bash
npm install
docker compose up -d
cp backend/.env.example backend/.env
npm run prisma:generate -w backend
npm run prisma:dev -w backend
npm run dev
```

API listens at `http://localhost:3001`.

Health endpoints:

- `GET /health/live`
- `GET /health/ready` — includes a Postgres connectivity check

Incident endpoints (M1 — persistence only, no analysis yet):

- `POST /api/incidents` — `{ title, description }`
- `GET /api/incidents` — paginated list
- `GET /api/incidents/:id` — single incident with job history
