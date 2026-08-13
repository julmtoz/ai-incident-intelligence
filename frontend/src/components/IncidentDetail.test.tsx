import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { incidentWithStatus } from "../test/fixtures";
import { IncidentDetail } from "./IncidentDetail";

describe("IncidentDetail", () => {
  it.each(["QUEUED", "PROCESSING"] as const)("renders the %s state", (status) => {
    render(<IncidentDetail incident={incidentWithStatus(status)} />);
    expect(screen.getByText(status)).toBeInTheDocument();
  });

  it("renders completed structured analysis and GitHub context", () => {
    render(<IncidentDetail incident={incidentWithStatus("COMPLETED")} />);
    expect(screen.getByText("The connection pool is exhausted under peak traffic.")).toBeInTheDocument();
    expect(screen.getByText("Inspect active database connections.")).toBeInTheDocument();
    expect(screen.getByText("Database connectivity")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /pool timeout under load/i })).toHaveAttribute("href", "https://github.com/example/repo/issues/1");
  });

  it("renders safe failed-state guidance without the stored provider error", () => {
    render(<IncidentDetail incident={incidentWithStatus("FAILED")} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Analysis could not be completed");
    expect(screen.queryByText("provider raw error")).not.toBeInTheDocument();
  });
});
