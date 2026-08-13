import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { incidentsApi } from "../api/client";
import { incidentWithStatus } from "../test/fixtures";
import { POLL_INTERVAL_MS, useIncidentPolling } from "./useIncidentPolling";

describe("useIncidentPolling", () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("stops after a terminal response", async () => {
    vi.useFakeTimers();
    const get = vi.spyOn(incidentsApi, "get").mockResolvedValue(incidentWithStatus("COMPLETED"));
    const onUpdate = vi.fn();
    const onError = vi.fn();
    renderHook(() => useIncidentPolling(incidentWithStatus("QUEUED"), onUpdate, onError));
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS); });
    expect(get).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: "incident-1" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2); });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("aborts and clears polling on unmount", async () => {
    vi.useFakeTimers();
    const get = vi.spyOn(incidentsApi, "get").mockResolvedValue(incidentWithStatus("PROCESSING"));
    const { unmount } = renderHook(() => useIncidentPolling(incidentWithStatus("QUEUED"), vi.fn(), vi.fn()));
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2); });
    expect(get).not.toHaveBeenCalled();
  });
});
