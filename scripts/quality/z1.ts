/**
 * Z1: slot declaration, JSON and version validation for the local gates.
 *
 * `scripts/quality/slot-status.json` declares which of the twelve System0 slots
 * this project implements. The declaration is the only source of truth: the gate
 * refuses to run when it is malformed, when it disagrees with the local slot
 * table, or when the slots that ran did not all test the same version.
 */

export const SLOT_IDS = [
  "S1",
  "S2",
  "S3",
  "G1",
  "G2",
  "B1",
  "L1",
  "L2",
  "L3",
  "L4",
  "P1",
  "Z1",
] as const;

export type SlotId = (typeof SLOT_IDS)[number];

export type SlotStatus = "impl" | "na" | "todo";

export interface SlotDeclaration {
  id: SlotId;
  status: SlotStatus;
  reason?: string;
}

export interface DeclarationError {
  path: string;
  message: string;
}

export interface DeclarationResult {
  declarations: SlotDeclaration[];
  errors: DeclarationError[];
}

export interface SlotVersion {
  id: string;
  sha: string | undefined;
}

const STATUSES: readonly SlotStatus[] = ["impl", "na", "todo"];
const ALLOWED_FIELDS = ["id", "status", "reason"];
const SHA_PATTERN = /^[0-9a-f]{40}$/;

export function validateSlotDeclarations(input: unknown): DeclarationResult {
  const errors: DeclarationError[] = [];
  const declarations: SlotDeclaration[] = [];

  if (!Array.isArray(input)) {
    return {
      declarations,
      errors: [{ path: "$", message: "slot declaration must be an array of entries" }],
    };
  }

  const seen = new Set<string>();

  input.forEach((entry, index) => {
    const path = `$[${index}]`;
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      errors.push({ path, message: "slot entry must be an object" });
      return;
    }
    const record = entry as Record<string, unknown>;
    for (const field of Object.keys(record)) {
      if (!ALLOWED_FIELDS.includes(field)) {
        errors.push({ path, message: `unknown field "${field}"` });
      }
    }

    const id = record.id;
    if (typeof id !== "string" || !SLOT_IDS.includes(id as SlotId)) {
      errors.push({ path: `${path}.id`, message: `unknown slot id ${JSON.stringify(id)}` });
      return;
    }
    if (seen.has(id)) {
      errors.push({ path: `${path}.id`, message: `duplicate slot id ${id}` });
      return;
    }
    seen.add(id);

    const status = record.status;
    if (typeof status !== "string" || !STATUSES.includes(status as SlotStatus)) {
      errors.push({
        path: `${path}.status`,
        message: `status must be one of ${STATUSES.join(", ")}`,
      });
      return;
    }

    const reason = record.reason;
    if (reason !== undefined && (typeof reason !== "string" || reason.trim() === "")) {
      errors.push({ path: `${path}.reason`, message: "reason must be a non-empty string" });
      return;
    }
    if (status !== "impl" && reason === undefined) {
      errors.push({
        path: `${path}.reason`,
        message: `slot ${id} is ${status} and needs a reason`,
      });
      return;
    }
    if (status === "impl" && reason !== undefined) {
      errors.push({
        path: `${path}.reason`,
        message: `implemented slot ${id} must not declare a reason`,
      });
      return;
    }

    declarations.push(
      reason === undefined
        ? { id: id as SlotId, status: status as SlotStatus }
        : { id: id as SlotId, status: status as SlotStatus, reason },
    );
  });

  for (const id of SLOT_IDS) {
    if (!seen.has(id)) {
      errors.push({ path: "$", message: `slot ${id} is missing from the declaration` });
    }
  }

  return { declarations, errors };
}

export function parseSlotStatus(text: string): DeclarationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      declarations: [],
      errors: [
        {
          path: "$",
          message: `slot declaration is not valid JSON: ${(error as Error).message}`,
        },
      ],
    };
  }
  return validateSlotDeclarations(parsed);
}

export function formatDeclarationErrors(errors: DeclarationError[]): string {
  return errors.map((error) => `  ${error.path}: ${error.message}`).join("\n");
}

export function validateSlotVersions(versions: SlotVersion[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  let expected: string | undefined;

  for (const version of versions) {
    if (seen.has(version.id)) {
      errors.push(`slot ${version.id} reported its version twice`);
    }
    seen.add(version.id);

    if (version.sha === undefined) {
      errors.push(`slot ${version.id} did not report the version it tested`);
      continue;
    }
    if (!SHA_PATTERN.test(version.sha)) {
      errors.push(`slot ${version.id} reported an invalid version "${version.sha}"`);
      continue;
    }
    if (expected === undefined) {
      expected = version.sha;
    } else if (expected !== version.sha) {
      errors.push(
        `slot ${version.id} tested ${version.sha} while the other slots tested ${expected}`,
      );
    }
  }

  return errors;
}
