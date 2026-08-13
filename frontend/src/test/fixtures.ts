import type { Incident, JobStatus } from "../types";

export function incidentWithStatus(status: JobStatus): Incident {
  return {
    id: "incident-1",
    title: "Checkout API returning 503s",
    description: "Requests fail after the latest database connection pool configuration change.",
    severity: status === "COMPLETED" ? "HIGH" : null,
    category: status === "COMPLETED" ? "Database connectivity" : null,
    createdAt: "2026-08-13T16:00:00.000Z",
    updatedAt: "2026-08-13T16:00:00.000Z",
    jobs: [{
      id: "job-1", incidentId: "incident-1", status, attempts: 1,
      rootCause: status === "COMPLETED" ? "The connection pool is exhausted under peak traffic." : null,
      suggestedSteps: status === "COMPLETED" ? JSON.stringify(["Inspect active database connections.", "Restore the previous pool limit."]) : null,
      externalContext: status === "COMPLETED" ? [{ sourceType: "github_issue", title: "Pool timeout under load", url: "https://github.com/example/repo/issues/1", excerpt: "Similar pool exhaustion symptoms.", repository: "example/repo" }] : null,
      error: status === "FAILED" ? "provider raw error" : null,
      createdAt: "2026-08-13T16:00:00.000Z", startedAt: null, completedAt: null,
    }],
  };
}
