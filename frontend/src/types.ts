export type JobStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ExternalContextItem {
  sourceType: "github_issue";
  title: string;
  url: string;
  excerpt: string;
  repository: string;
}

export interface AnalysisJob {
  id: string;
  incidentId: string;
  status: JobStatus;
  attempts: number;
  rootCause: string | null;
  suggestedSteps: string | null;
  externalContext: ExternalContextItem[] | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: Severity | null;
  category: string | null;
  createdAt: string;
  updatedAt: string;
  jobs: AnalysisJob[];
}

export interface IncidentListResponse {
  items: Incident[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateIncidentInput {
  title: string;
  description: string;
}
