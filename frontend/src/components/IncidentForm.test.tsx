import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IncidentForm } from "./IncidentForm";

describe("IncidentForm", () => {
  it("validates and submits the supported API fields", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<IncidentForm isSubmitting={false} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /analyze incident/i }));
    expect(screen.getByText("Use at least 3 characters.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Incident title"), "API unavailable");
    await user.type(screen.getByLabelText("Description and logs"), "Customers receive a 503 response at checkout.");
    await user.click(screen.getByRole("button", { name: /analyze incident/i }));
    expect(onSubmit).toHaveBeenCalledWith({ title: "API unavailable", description: "Customers receive a 503 response at checkout." });
  });
});
