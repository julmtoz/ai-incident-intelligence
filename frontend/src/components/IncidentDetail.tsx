import type { Incident } from "../types";
import { formatDate, latestJob, parseSuggestedSteps } from "../utils/incidents";
import { StatusBadge } from "./StatusBadge";

export function IncidentDetail({ incident }: { incident: Incident | null }) {
  if (!incident) {
    return <section className="panel detail-empty"><div className="detail-empty__orb">✦</div><h2>Analysis workspace</h2><p>Select an incident to inspect its AI assessment and supporting context.</p></section>;
  }

  const job = latestJob(incident);
  const steps = parseSuggestedSteps(job?.suggestedSteps ?? null);
  const context = Array.isArray(job?.externalContext) ? job.externalContext : [];

  return (
    <section className="panel detail-panel" aria-labelledby="incident-detail-title">
      <div className="detail-header">
        <div>
          <div className="detail-header__meta">
            {job ? <StatusBadge value={job.status} /> : null}
            <time dateTime={incident.createdAt}>{formatDate(incident.createdAt)}</time>
          </div>
          <h2 id="incident-detail-title">{incident.title}</h2>
          <p>{incident.description}</p>
        </div>
      </div>

      {job?.status === "QUEUED" || job?.status === "PROCESSING" ? (
        <div className="progress-card" role="status" aria-live="polite">
          <div className="progress-card__icon"><span className="spinner spinner--large" /></div>
          <div><h3>{job.status === "QUEUED" ? "Analysis queued" : "Analyzing incident"}</h3><p>{job.status === "QUEUED" ? "Waiting for an available worker…" : "Classifying impact and researching relevant technical context…"}</p></div>
        </div>
      ) : null}

      {job?.status === "FAILED" ? (
        <div className="failure-card" role="alert">
          <span className="failure-card__icon" aria-hidden="true">!</span>
          <div><h3>Analysis could not be completed</h3><p>The automated analysis exhausted its retry attempts. Review the incident details and submit a new incident to try again. If the problem persists, ask an administrator to check the worker service.</p></div>
        </div>
      ) : null}

      {job?.status === "COMPLETED" ? (
        <div className="analysis-results">
          <div className="summary-grid">
            <div className="metric-card"><span>Severity</span>{incident.severity ? <StatusBadge value={incident.severity} /> : <strong>—</strong>}</div>
            <div className="metric-card"><span>Category</span><strong>{incident.category ?? "Unclassified"}</strong></div>
            <div className="metric-card"><span>Attempts</span><strong>{job.attempts}</strong></div>
          </div>
          <article className="result-section">
            <p className="eyebrow">AI assessment</p><h3>Probable root cause</h3><p className="root-cause">{job.rootCause ?? "No root cause was returned."}</p>
          </article>
          <article className="result-section">
            <p className="eyebrow">Recommended response</p><h3>Troubleshooting steps</h3>
            {steps.length ? <ol className="steps">{steps.map((step, index) => <li key={`${index}-${step}`}><span>{index + 1}</span><p>{step}</p></li>)}</ol> : <p>No troubleshooting steps were returned.</p>}
          </article>
          <article className="result-section">
            <div className="section-title-row"><div><p className="eyebrow">External context</p><h3>Related GitHub issues</h3></div><span className="source-chip">GitHub REST API</span></div>
            {context.length ? <div className="context-list">{context.map((item) => (
              <a className="context-card" href={item.url} target="_blank" rel="noreferrer" key={item.url}>
                <div><span>{item.repository}</span><strong>{item.title}</strong><p>{item.excerpt}</p></div><span className="external-arrow" aria-hidden="true">↗</span>
              </a>
            ))}</div> : <p className="muted">No relevant public GitHub issues were found for this analysis.</p>}
          </article>
        </div>
      ) : null}
    </section>
  );
}
