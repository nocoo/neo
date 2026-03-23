#!/usr/bin/env bun
/**
 * G2: Security gate — osv-scanner (dependency CVEs) + gitleaks (secret detection)
 * Runs in pre-push alongside L2.
 */

import { $ } from "bun";

const errors: string[] = [];

// 1. osv-scanner: check bun.lock for known vulnerabilities
console.log("🔍 G2: osv-scanner — checking dependencies...");
try {
  await $`osv-scanner scan source --lockfile=bun.lock --config=.osv-scanner.toml .`.quiet();
  console.log("✅ osv-scanner: no vulnerabilities found");
} catch (e: unknown) {
  const err = e as { exitCode: number };
  if (err.exitCode === 127) {
    console.error(
      "❌ osv-scanner not installed. Install: brew install osv-scanner"
    );
    errors.push("osv-scanner not installed");
  } else {
    console.error("❌ osv-scanner: vulnerabilities detected");
    errors.push("osv-scanner found vulnerabilities");
  }
}

// 2. gitleaks: detect secrets in staged/committed code
console.log("🔍 G2: gitleaks — checking for secrets...");
try {
  // Detect secrets in commits not yet pushed to upstream
  const upstream = await $`git rev-parse --abbrev-ref @{u}`
    .text()
    .catch(() => "origin/main");
  await $`gitleaks git --log-opts=${upstream.trim()}..HEAD --no-banner`.quiet();
  console.log("✅ gitleaks: no secrets detected");
} catch (e: unknown) {
  const err = e as { exitCode: number };
  if (err.exitCode === 127) {
    console.error(
      "❌ gitleaks not installed. Install: brew install gitleaks"
    );
    errors.push("gitleaks not installed");
  } else {
    console.error("❌ gitleaks: potential secrets detected");
    errors.push("gitleaks found potential secrets");
  }
}

if (errors.length > 0) {
  console.error(`\n💀 G2 Security gate FAILED: ${errors.join(", ")}`);
  process.exit(1);
}

console.log("\n✅ G2 Security gate passed");
