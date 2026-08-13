import type { CreateIncidentInput, Incident, IncidentListResponse } from "../types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError("Unable to reach the incident service. Check that the backend is running.");
  }

  if (!response.ok) {
    let message = "The incident service could not complete this request.";
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body.error === "string") message = body.error;
    } catch {
      // Keep the safe default instead of exposing an unstructured server response.
    }
    throw new ApiError(message, response.status);
  }

  return response.json() as Promise<T>;
}

export const incidentsApi = {
  list: (signal?: AbortSignal) =>
    request<IncidentListResponse>("/api/incidents?page=1&pageSize=50", { signal }),
  get: (id: string, signal?: AbortSignal) =>
    request<Incident>(`/api/incidents/${encodeURIComponent(id)}`, { signal }),
  create: (input: CreateIncidentInput) =>
    request<Incident>("/api/incidents", { method: "POST", body: JSON.stringify(input) }),
};
