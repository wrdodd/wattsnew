import cron from "node-cron";
import { loadCuratorConfig } from "./config";
import { curate } from "./curate";

let started = false;

/**
 * Start the in-process curator: validate the schedule, optionally run once
 * immediately (fire-and-forget so server boot isn't blocked), then schedule
 * recurring runs with node-cron. Idempotent — safe to call more than once.
 */
export function startCurator(): void {
  if (started) return;
  started = true;

  const config = loadCuratorConfig();
  if (!config.enabled) {
    console.log("[curator] disabled via CURATOR_ENABLED — not scheduling");
    return;
  }
  if (!cron.validate(config.cron)) {
    console.error(`[curator] invalid CRON "${config.cron}" — curator not scheduled`);
    return;
  }

  if (config.runOnStart) {
    curate(config).catch((err) => console.error("[curator] initial run failed:", err));
  }

  cron.schedule(
    config.cron,
    () => {
      curate(config).catch((err) => console.error("[curator] scheduled run failed:", err));
    },
    { timezone: config.timezone },
  );

  console.log(`[curator] scheduled "${config.cron}" (${config.timezone})`);
}
