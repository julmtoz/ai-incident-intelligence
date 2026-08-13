import { useCallback, useEffect, useMemo, useState } from "react";
import { incidentsApi } from "./api/client";
import { IncidentDetail } from "./components/IncidentDetail";
import { IncidentForm } from "./components/IncidentForm";
import { IncidentList } from "./components/IncidentList";
import { useIncidentPolling } from "./hooks/useIncidentPolling";
import type { CreateIncidentInput, Incident } from "./types";
import { latestJob } from "./utils/incidents";

export default function App() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => incidents.find((incident) => incident.id === selectedId) ?? null,
    [incidents, selectedId]
  );

  const upsertIncident = useCallback((updated: Incident) => {
    setIncidents((current) => {
      const exists = current.some((incident) => incident.id === updated.id);
      return exists
        ? current.map((incident) => incident.id === updated.id ? updated : incident)
        : [updated, ...current];
    });
  }, []);
  const handlePollingError = useCallback((message: string) => setError(message), []);
  useIncidentPolling(selected, upsertIncident, handlePollingError);

  useEffect(() => {
    const controller = new AbortController();
    incidentsApi.list(controller.signal)
      .then((response) => {
        setIncidents(response.items);
        setSelectedId((current) => current ?? response.items[0]?.id ?? null);
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "Unable to load incidents.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, []);

  async function handleSubmit(input: CreateIncidentInput) {
    setIsSubmitting(true);
    setError(null);
    try {
      const created = await incidentsApi.create(input);
      upsertIncident(created);
      setSelectedId(created.id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit the incident.");
      throw submitError;
    } finally {
      setIsSubmitting(false);
    }
  }

  const activeCount = incidents.filter((incident) => {
    const status = latestJob(incident)?.status;
    return status === "QUEUED" || status === "PROCESSING";
  }).length;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#main-content" aria-label="SignalDesk home">
          <span className="brand__mark" aria-hidden="true"><span /></span>
          <span><strong>SignalDesk</strong><small>Incident intelligence</small></span>
        </a>
        <div className="system-state"><span className="system-state__dot" /><span><strong>Systems operational</strong><small>{activeCount ? `${activeCount} analysis${activeCount === 1 ? "" : "es"} active` : "Ready for analysis"}</small></span></div>
      </header>

      <main id="main-content">
        <section className="hero">
          <div><p className="eyebrow">Operations command center</p><h1>Turn incident noise into<br /><span>clear next steps.</span></h1><p>AI-assisted classification, root-cause analysis, and technical context—without leaving your response workflow.</p></div>
          <div className="hero__signal" aria-hidden="true"><span>AI</span><i /><i /><i /></div>
        </section>

        {error ? <div className="toast" role="alert"><span>!</span><p>{error}</p><button type="button" onClick={() => setError(null)} aria-label="Dismiss error">×</button></div> : null}

        <div className="workspace">
          <aside className="workspace__sidebar">
            <IncidentForm isSubmitting={isSubmitting} onSubmit={handleSubmit} />
            <IncidentList incidents={incidents} selectedId={selectedId} isLoading={isLoading} onSelect={(incident) => setSelectedId(incident.id)} />
          </aside>
          <IncidentDetail incident={selected} />
        </div>
      </main>
      <footer><span>SignalDesk</span><span>AI output should be verified before production changes.</span></footer>
    </div>
  );
}
