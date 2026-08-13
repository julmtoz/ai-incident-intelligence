import { FormEvent, useState } from "react";
import type { CreateIncidentInput } from "../types";

interface IncidentFormProps {
  isSubmitting: boolean;
  onSubmit: (input: CreateIncidentInput) => Promise<void>;
}

export function IncidentForm({ isSubmitting, onSubmit }: IncidentFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<{ title?: string; description?: string }>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    if (cleanTitle.length < 3) nextErrors.title = "Use at least 3 characters.";
    if (cleanDescription.length < 10) nextErrors.description = "Add at least 10 characters of context.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      await onSubmit({ title: cleanTitle, description: cleanDescription });
      setTitle("");
      setDescription("");
    } catch {
      // The parent owns safe API error messaging; keep the user's input for retry.
    }
  }

  return (
    <section className="panel submission-panel" aria-labelledby="new-incident-title">
      <div className="panel__heading">
        <div>
          <p className="eyebrow">New analysis</p>
          <h2 id="new-incident-title">Report an incident</h2>
        </div>
        <span className="ai-chip"><span aria-hidden="true">✦</span> AI assisted</span>
      </div>
      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="incident-title">Incident title</label>
          <input
            id="incident-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-describedby={errors.title ? "title-error" : undefined}
            aria-invalid={Boolean(errors.title)}
            placeholder="e.g. Checkout API returning 503s"
            maxLength={200}
          />
          {errors.title ? <p className="field__error" id="title-error">{errors.title}</p> : null}
        </div>
        <div className="field">
          <div className="label-row">
            <label htmlFor="incident-description">Description and logs</label>
            <span>{description.length}/5000</span>
          </div>
          <textarea
            id="incident-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            aria-describedby={errors.description ? "description-error" : "description-help"}
            aria-invalid={Boolean(errors.description)}
            placeholder="Describe the symptoms, affected systems, recent changes, and paste any relevant error text…"
            rows={7}
            maxLength={5000}
          />
          {errors.description ? (
            <p className="field__error" id="description-error">{errors.description}</p>
          ) : (
            <p className="field__help" id="description-help">Secrets and credentials should never be included.</p>
          )}
        </div>
        <button className="button button--primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <span className="spinner" aria-hidden="true" /> : <span aria-hidden="true">✦</span>}
          {isSubmitting ? "Submitting…" : "Analyze incident"}
        </button>
      </form>
    </section>
  );
}
