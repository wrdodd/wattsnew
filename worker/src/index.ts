import cron from "node-cron";
import { loadConfig } from "./config.js";
import { curate } from "./curate.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const runOnce = process.argv.includes("run-once");

  if (runOnce) {
    await curate(config);
    return;
  }

  if (!cron.validate(config.cron)) {
    console.error(`Invalid CRON expression: "${config.cron}"`);
    process.exit(1);
  }

  if (config.runOnStart) {
    try {
      await curate(config);
    } catch (err) {
      console.error("initial run failed:", err);
    }
  }

  cron.schedule(
    config.cron,
    () => {
      curate(config).catch((err) => console.error("scheduled run failed:", err));
    },
    { timezone: config.timezone },
  );

  console.log(`Scheduled "${config.cron}" (${config.timezone}). Worker is running; waiting for next run.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
