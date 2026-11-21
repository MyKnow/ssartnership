/** A write may have committed even when its response was lost. */
export class PartnerMutationOutcomeUnknownError extends Error {
  readonly stage: string;

  constructor(stage: string, cause: unknown) {
    super("partner_mutation_outcome_unknown", { cause });
    this.name = "PartnerMutationOutcomeUnknownError";
    this.stage = stage;
  }
}

export type PartnerMutationCleanupCause = {
  originalError: unknown;
  cleanupError: unknown;
};

/** A failed compensation cannot safely be treated as a rolled-back attempt. */
export class PartnerMutationCleanupError extends Error {
  declare readonly cause: PartnerMutationCleanupCause;

  constructor(message: string, cause: PartnerMutationCleanupCause) {
    super(message, { cause });
    this.name = "PartnerMutationCleanupError";
  }
}

/** Only wrap mutation awaits: reads and known 4xx errors keep their own handling. */
export async function awaitPartnerMutation<T extends { status: number; error: unknown }>(
  operation: PromiseLike<T>,
  stage: string,
): Promise<T> {
  let result: T;
  try {
    result = await operation;
  } catch (error) {
    throw new PartnerMutationOutcomeUnknownError(stage, error);
  }
  // PostgREST resolves transport/body-read errors with status 0. A gateway 5xx
  // also cannot establish whether an upstream transaction already committed.
  if (result.status === 0 || result.status >= 500) {
    throw new PartnerMutationOutcomeUnknownError(stage, result.error);
  }
  return result;
}

/** A successful status alone is insufficient: the SDK normalizes some 404s. */
export function requirePartnerMutationReceipt(
  data: unknown,
  expectedRows: ReadonlyArray<Readonly<Record<string, unknown>>>,
  stage: string,
) {
  const matches = (row: unknown, expected: Readonly<Record<string, unknown>>) =>
    row !== null && typeof row === "object" && !Array.isArray(row)
    && Object.entries(expected).every(([key, value]) =>
      Object.hasOwn(row, key) && (row as Record<string, unknown>)[key] === value,
    );
  if (!Array.isArray(data) || expectedRows.length === 0 || data.length !== expectedRows.length
    || !expectedRows.every((expected) => data.filter((row) => matches(row, expected)).length === 1)
    || !data.every((row) => expectedRows.filter((expected) => matches(row, expected)).length === 1)) {
    throw new PartnerMutationOutcomeUnknownError(stage, new Error("partner_mutation_receipt_incomplete"));
  }
}

/** Inserts may generate an ID; updates must acknowledge the caller's ID. */
export function requirePartnerMutationRow(
  data: unknown,
  expected: Readonly<Record<string, unknown>>,
  stage: string,
): asserts data is Record<string, unknown> & { id: string } {
  const row = data as Record<string, unknown> | null;
  if (!row || typeof row !== "object" || Array.isArray(row)
    || typeof row.id !== "string" || !row.id.trim()) {
    throw new PartnerMutationOutcomeUnknownError(stage, new Error("partner_mutation_receipt_incomplete"));
  }
  requirePartnerMutationReceipt([row], [{ ...expected, id: expected.id ?? row.id }], stage);
}
