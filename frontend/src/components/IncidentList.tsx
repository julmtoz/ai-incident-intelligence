import type { Incident } from "../types";
import { formatDate, latestJob } from "../utils/incidents";
import { StatusBadge } from "./StatusBadge";

interface IncidentListProps {
  incidents: Incident[];
  selectedId: string | null;
  isLoading: boolean;
  onSelect: (incident: Incident) => void;
}

export function IncidentList({ incidents, selectedId, isLoading, onSelect }: IncidentListProps) {
  return (
    <section className="panel incident-list-panel" aria-labelledby="incidents-title">
      <div className="panel__heading list-heading">
        <div>
          <p className="eyebrow">Operations queue</p>
          <h2 id="incidents-title">Recent incidents</h2>
        </div>
        <span className="count-chip">{incidents.length}</span>
      </div>
      <div className="incident-list" aria-busy={isLoading}>
        {isLoading ? (
          <div className="empty-state"><span className="spinner spinner--large" /><p>Loading incidents…</p></div>
        ) : incidents.length === 0 ? (
          <div className="empty-state"><span className="empty-icon" aria-hidden="true">↗</span><h3>No incidents yet</h3><p>Your first AI analysis will appear here.</p></div>
        ) : incidents.map((incident) => {
          const job = latestJob(incident);
          return (
            <button
              type="button"
              className={`incident-row${selectedId === incident.id ? " incident-row--selected" : ""}`}
              key={incident.id}
              onClick={() => onSelect(incident)}
              aria-pressed={selectedId === incident.id}
            >
              <span className="incident-row__top">
                <strong>{incident.title}</strong>
                {job ? <StatusBadge value={job.status} /> : null}
              </span>
              <span className="incident-row__meta">
                <span>{incident.category ?? "Awaiting classification"}</span>
                <span aria-hidden="true">•</span>
                <time dateTime={incident.createdAt}>{formatDate(incident.createdAt)}</time>
              </span>
              {incident.severity ? <StatusBadge value={incident.severity} /> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
