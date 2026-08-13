import type { AnalysisJob, Incident } from "../types";

export function latestJob(incident: Incident): AnalysisJob | undefined {
  return incident.jobs.reduce<AnalysisJob | undefined>((latest, job) => {
    if (!latest) return job;
    return new Date(job.createdAt).getTime() > new Date(latest.createdAt).getTime() ? job : latest;
  }, undefined);
}

export function parseSuggestedSteps(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string")
      ? parsed
      : [value];
  } catch {
    return [value];
  }
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
