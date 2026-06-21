import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Produce a self-contained server bundle so the Docker image stays small.
  output: "standalone",
  // Pin the workspace root to this project (a stray lockfile elsewhere on the
  // machine otherwise confuses file tracing for the standalone build).
  outputFileTracingRoot: path.resolve(__dirname),
  turbopack: { root: path.resolve(__dirname) },
  // Native/heavy server-only packages we don't want webpack to bundle. The
  // in-process curator (instrumentation.ts) lazy-loads the LLM SDKs only when a
  // provider is configured; keeping them external avoids bundling them at all.
  serverExternalPackages: ["puppeteer-core", "@anthropic-ai/sdk", "openai"],
  outputFileTracingIncludes: {
    "/api/article": ["./node_modules/puppeteer-core/**/*"],
  },
};

export default nextConfig;
