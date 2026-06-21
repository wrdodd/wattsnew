/**
 * Next.js instrumentation: runs once when the server process starts. We use it
 * to launch the in-process news curator (the old standalone "worker"), so the
 * whole app — reader + curation — runs in a single container/process.
 *
 * Guarded to the Node.js runtime so it never tries to start in the Edge runtime
 * (where `proxy.ts`/middleware runs) or during the build's static analysis.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startCurator } = await import("./lib/curator/start");
  startCurator();
}
