import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Produce a self-contained server bundle so the Docker image stays small.
  output: "standalone",
  // Pin the workspace root to this project (a stray lockfile elsewhere on the
  // machine otherwise confuses file tracing for the standalone build).
  outputFileTracingRoot: path.resolve(__dirname),
  turbopack: { root: path.resolve(__dirname) },
  // puppeteer-core talks to a system Chromium over CDP — don't bundle it, and
  // make sure its files land in the standalone output.
  serverExternalPackages: ["puppeteer-core"],
  outputFileTracingIncludes: {
    "/api/article": ["./node_modules/puppeteer-core/**/*"],
  },
};

export default nextConfig;
