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
- [x] **M2 — Job pipeline:** BullMQ queue wired to Redis; submitting an
      incident enqueues a job; job status persisted and queryable
- [x] **M3 — AI integration:** OpenAI Responses API call inside the worker —
      severity/category classification, root-cause summary, suggested steps
- [x] **M4 — External context:** GitHub REST API lookup folded into analysis
- [x] **M5 — Frontend:** responsive React dashboard with incident submission,
      status polling, analysis results, and GitHub context
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

## Local setup (current M5 scope)

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

In a second terminal, start the frontend:

```bash
npm run dev:frontend
```

The dashboard opens at `http://localhost:5173`. During development, Vite
proxies `/api` and `/health` requests to the backend. To use a different API
origin, copy `frontend/.env.example` to `frontend/.env` and set
`VITE_API_BASE_URL`. The browser never calls OpenAI or GitHub directly.

Health endpoints:

- `GET /health/live`
- `GET /health/ready` — includes a Postgres connectivity check

Incident endpoints:

- `POST /api/incidents` — `{ title, description }`; persists the incident and
  queues AI analysis
- `GET /api/incidents` — paginated list
- `GET /api/incidents/:id` — single incident with job history

The background worker uses `gpt-5-mini` with a strict structured-output schema.
It persists severity and category on the incident, plus root cause and a
JSON-encoded array of suggested steps on the analysis job. Failed calls retry
up to three total attempts with exponential backoff before becoming `FAILED`.
Before analysis, the worker makes one bounded public GitHub issue search and
stores up to three normalized results in `AnalysisJob.externalContext`.
`GITHUB_TOKEN` is optional and used only by the backend; without it, the lookup
uses GitHub's lower-limit unauthenticated public API. GitHub lookup failures are
non-fatal and analysis continues using the incident report alone.

## Frontend workflow

The M5 dashboard submits incidents through the existing API, adds them to the
local incident list immediately, and polls the selected incident every 2.5
seconds while its latest job is `QUEUED` or `PROCESSING`. Polling stops at
`COMPLETED` or `FAILED`. Completed jobs show classification, probable root
cause, parsed troubleshooting steps, and any normalized GitHub issue context.
Failed jobs show safe retry guidance without exposing stored provider errors.

Production hardening, CI, container images, and deployment remain explicitly
pending for M6.
