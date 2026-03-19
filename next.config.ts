import withSerwistInit from "@serwist/next";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["neo.dev.hexly.ai"],
};

// Only apply Serwist webpack plugin for production builds.
// In dev mode (Turbopack), skip it to avoid the webpack/turbopack mismatch warning.
const isDev = process.env.NODE_ENV === "development";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: isDev,
});

export default isDev ? nextConfig : withSerwist(nextConfig);
