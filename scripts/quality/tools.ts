/**
 * Toolchain and scanner checks shared by the local gates (system0-quality: a
 * missing tool or report must fail the gate) and `scripts/run-security.ts`.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface ToolCheck {
  name: string;
  ok: boolean;
  detail: string;
}

interface ToolSpec {
  bin: string;
  args: string[];
  minimum: string;
  pattern: RegExp;
}

const TOOLS = {
  gitleaks: {
    bin: "gitleaks",
    args: ["version"],
    minimum: "8.30.1",
    pattern: /(\d+\.\d+\.\d+)/,
  },
  osv: {
    bin: "osv-scanner",
    args: ["--version"],
    minimum: "2.5.1",
    pattern: /osv-scanner version:\s*(\d+\.\d+\.\d+)/,
  },
  actionlint: {
    bin: "actionlint",
    args: ["--version"],
    minimum: "1.7.12",
    pattern: /(\d+\.\d+\.\d+)/,
  },
} satisfies Record<string, ToolSpec>;

export type ToolKey = keyof typeof TOOLS;

export function compareVersions(a: string, b: string): number {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function run(
  bin: string,
  args: string[],
): Promise<{ code: number; text: string } | undefined> {
  const which = Bun.which(bin);
  if (!which) return undefined;
  const proc = Bun.spawn([which, ...args], { stdout: "pipe", stderr: "pipe" });
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  return { code, text: `${out}\n${err}` };
}

export async function checkTool(key: ToolKey): Promise<ToolCheck> {
  const spec = TOOLS[key];
  const result = await run(spec.bin, spec.args);
  if (!result) {
    return {
      name: key,
      ok: false,
      detail: `${spec.bin} not found on PATH (need >= ${spec.minimum})`,
    };
  }
  const match = spec.pattern.exec(result.text);
  if (!match) {
    return {
      name: key,
      ok: false,
      detail: `${spec.bin} ${spec.args.join(" ")} printed no version`,
    };
  }
  const version = match[1];
  if (version === undefined) {
    return { name: key, ok: false, detail: `${spec.bin} printed no version` };
  }
  if (compareVersions(version, spec.minimum) < 0) {
    return { name: key, ok: false, detail: `${spec.bin} ${version} < required ${spec.minimum}` };
  }
  return { name: key, ok: true, detail: `${spec.bin} ${version}` };
}

/** Bun version the CI workflow pins for this repository, when it declares one. */
export function declaredRuntimeVersion(root: string): string | undefined {
  for (const name of ["quality-slots.yml", "ci.yml"]) {
    const path = join(root, ".github", "workflows", name);
    if (!existsSync(path)) continue;
    const match = /runtime-version:\s*"?([0-9]+\.[0-9]+\.[0-9]+)"?/.exec(
      readFileSync(path, "utf-8"),
    );
    if (match?.[1]) return match[1];
  }
  return undefined;
}

export async function checkBun(root: string): Promise<ToolCheck> {
  const result = await run("bun", ["--version"]);
  if (result?.code !== 0) {
    return { name: "bun", ok: false, detail: "bun is required" };
  }
  const actual = result.text.trim().split("\n")[0]?.trim() ?? "";
  const declared = declaredRuntimeVersion(root);
  if (!declared) {
    return { name: "bun", ok: true, detail: `${actual} (CI declares no runtime-version)` };
  }
  const sameMinor =
    actual.split(".").slice(0, 2).join(".") === declared.split(".").slice(0, 2).join(".");
  return {
    name: "bun",
    ok: sameMinor,
    detail: sameMinor
      ? `${actual} matches the CI runtime-version ${declared}`
      : `${actual} does not match the CI runtime-version ${declared}; install the declared toolchain`,
  };
}
