export const FORCE_EXIT_TIMEOUT_MS = 50_000;

export function scheduleForceExit(exit: () => void = () => process.exit(1)) {
  const timer = setTimeout(exit, FORCE_EXIT_TIMEOUT_MS);
  timer.unref();
  return timer;
}
