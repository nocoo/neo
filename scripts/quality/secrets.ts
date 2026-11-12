#!/usr/bin/env bun
/**
 * G1: Secrets — gitleaks over the content of a single gate stage.
 *
 *   --index-snapshot      pre-commit: scan the exported Git index (the content
 *                         that becomes the commit)
 *   --range=<a..b>        pre-push: scan the commits this push introduces
 *   --content             CI: scan the tracked files of HEAD (no node_modules
 *                         or untracked build output)
 *
 * A missing scanner, a wrong version and a scanner error are reported as gate
 * failures distinct from "leaks found". Findings are redacted.
 *
 * `gitleaks git --staged` is deliberately not used: with 8.30.1 it scans the
 * diff header of a new file instead of its content, so a staged secret passed
 * clean.
 */
import { existsSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkTool } from "./tools";

const args = process.argv.slice(2);
const value = (name: string) =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const indexSnapshot = args.includes("--index-snapshot");
const content = args.includes("--content");
const range = value("range");
const snapshotRoot = process.env.GATE_SNAPSHOT_ROOT;
const gitRoot = process.env.GATE_GIT_ROOT ?? process.cwd();

const modes = [indexSnapshot, content, Boolean(range)].filter(Boolean).length;
if (modes !== 1) {
  console.error("G1: pass exactly one of --index-snapshot, --content or --range=<a..b>");
  process.exit(2);
}

const sameDir = (a: string | undefined, b: string) => {
  if (!a) return false;
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return false;
  }
};

if (indexSnapshot && !sameDir(snapshotRoot, process.cwd())) {
  console.error(
    `G1: --index-snapshot requires GATE_SNAPSHOT_ROOT to be the current directory (got ${snapshotRoot ?? "unset"}); run .husky/pre-commit instead`,
  );
  process.exit(2);
}

const tool = await checkTool("gitleaks");
if (!tool.ok) {
  console.error(`G1: scanner unavailable — ${tool.detail}`);
  process.exit(2);
}

function configIn(root: string | undefined): string | undefined {
  if (!root) return undefined;
  const candidate = join(root, ".gitleaks.toml");
  return existsSync(candidate) ? candidate : undefined;
}

let contentRoot: string | undefined;
let exitCode = 1;
try {
  if (content) {
    contentRoot = mkdtempSync(join(tmpdir(), "neo-g1-content-"));
    const archive = join(contentRoot, "content.tar");
    const exportHead = Bun.spawn(["git", "archive", `--output=${archive}`, "HEAD"], {
      cwd: gitRoot,
      stdout: "pipe",
      stderr: "pipe",
    });
    if ((await exportHead.exited) !== 0) {
      console.error(`G1: git archive HEAD failed in ${gitRoot}`);
      exitCode = 2;
      throw new Error("git archive failed");
    }
    const extract = Bun.spawn(["tar", "-xf", archive, "-C", contentRoot], {
      cwd: gitRoot,
      stdout: "pipe",
      stderr: "pipe",
    });
    if ((await extract.exited) !== 0) {
      console.error(`G1: cannot extract HEAD snapshot in ${gitRoot}`);
      exitCode = 2;
      throw new Error("tar extract failed");
    }
  }

  // The config of the content under test wins: a pushed commit may ship its own
  // allowlist, and the gate must judge that commit by its own rules.
  const config = content
    ? configIn(contentRoot)
    : [configIn(snapshotRoot), configIn(gitRoot)].find(Boolean);
  if (!config) {
    console.error(`G1: .gitleaks.toml not found in ${contentRoot ?? snapshotRoot ?? gitRoot}`);
    exitCode = 2;
    throw new Error("gitleaks config missing");
  }

  const cwd = content ? (contentRoot as string) : indexSnapshot ? process.cwd() : gitRoot;
  const target = range
    ? `range ${range}`
    : indexSnapshot
      ? "index snapshot"
      : "tracked HEAD content";
  const invocation = range
    ? ["gitleaks", "git", `--log-opts=${range}`, "--no-banner", "--redact"]
    : ["gitleaks", "dir", ".", "--no-banner", "--redact"];
  invocation.push(`--config=${config}`);

  console.log(`G1: gitleaks (${tool.detail}) — ${target} in ${cwd}`);
  const proc = Bun.spawn(invocation, { cwd, stdout: "inherit", stderr: "inherit" });
  await proc.exited;
  const code = proc.exitCode ?? 1;

  if (code === 0) {
    console.log(`G1: 0 leaks in ${target}`);
    exitCode = 0;
  } else if (code === 1) {
    console.error(`G1: leaks found in ${target} — see the findings above`);
    exitCode = 1;
  } else {
    console.error(`G1: gitleaks itself failed (exit ${code}) for ${target}`);
    exitCode = 1;
  }
} catch {
  // a gate-specific message has already been printed
} finally {
  if (contentRoot) rmSync(contentRoot, { recursive: true, force: true });
}
process.exit(exitCode);
