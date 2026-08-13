import { useEffect } from "react";
import { incidentsApi } from "../api/client";
import type { Incident } from "../types";
import { latestJob } from "../utils/incidents";

export const POLL_INTERVAL_MS = 2500;

export function useIncidentPolling(
  incident: Incident | null,
  onUpdate: (incident: Incident) => void,
  onError: (message: string) => void
) {
  const jobStatus = incident ? latestJob(incident)?.status : undefined;
  const incidentId = incident?.id;

  useEffect(() => {
    if (!incidentId || (jobStatus !== "QUEUED" && jobStatus !== "PROCESSING")) return;

    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let active = true;

    const poll = async () => {
      try {
        const updated = await incidentsApi.get(incidentId, controller.signal);
        if (!active) return;
        onUpdate(updated);
        const status = latestJob(updated)?.status;
        if (status === "QUEUED" || status === "PROCESSING") {
          timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        onError(error instanceof Error ? error.message : "Unable to refresh analysis status.");
        timeoutId = setTimeout(poll, POLL_INTERVAL_MS * 2);
      }
    };

    timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      active = false;
      controller.abort();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [incidentId, jobStatus, onError, onUpdate]);
}
