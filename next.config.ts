import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

interface WebpackConfig {
  ignoreWarnings?: Array<{ module?: RegExp; message?: RegExp }>;
}

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["neo.dev.hexly.ai"],
  // Suppress Edge Runtime warnings from next-auth's jose dependency.
  // The CompressionStream/DecompressionStream APIs are not actually used
  // at runtime (JWE compression is disabled by default), but Next.js
  // still emits warnings during static analysis.
  webpack: (
    config: WebpackConfig,
    { isServer }: { isServer: boolean }
  ): WebpackConfig => {
    if (isServer) {
      config.ignoreWarnings = [
        ...(config.ignoreWarnings ?? []),
        {
          module: /jose.*deflate\.js/,
          message: /CompressionStream|DecompressionStream/,
        },
      ];
    }
    return config;
  },
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
