import type { JobStatus, Severity } from "../types";

export function StatusBadge({ value }: { value: JobStatus | Severity }) {
  const isActive = value === "QUEUED" || value === "PROCESSING";
  return (
    <span className={`badge badge--${value.toLowerCase()}`}>
      {isActive ? <span className="badge__pulse" aria-hidden="true" /> : null}
      {value}
    </span>
  );
}
