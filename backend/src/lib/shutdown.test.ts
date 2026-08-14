import { afterEach, describe, expect, it, vi } from "vitest";
import { FORCE_EXIT_TIMEOUT_MS, scheduleForceExit } from "./shutdown.js";

describe("graceful shutdown deadline", () => {
  afterEach(() => vi.useRealTimers());

  it("allows 50 seconds for active work before forcing exit", () => {
    vi.useFakeTimers();
    const exit = vi.fn();
    scheduleForceExit(exit);

    vi.advanceTimersByTime(FORCE_EXIT_TIMEOUT_MS - 1);
    expect(exit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(exit).toHaveBeenCalledOnce();
  });
});
