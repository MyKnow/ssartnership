import { logServerError } from "@/lib/server-log";

type PartnerCreateCleanupResult = {
  error: { code?: string; message: string } | null;
};

export type PartnerCreateCleanupOperation = {
  stage: string;
  run: () => PromiseLike<PartnerCreateCleanupResult>;
};

export async function rollbackCreatedPartnerPersistence(input: {
  operations: PartnerCreateCleanupOperation[];
  originalError: unknown;
}) {
  const failures: Array<{ stage: string; error: { code?: string; message: string } }> = [];

  for (const operation of input.operations) {
    let error: { code?: string; message: string } | null;
    try {
      ({ error } = await operation.run());
    } catch (operationError) {
      error = {
        message: operationError instanceof Error
          ? operationError.message
          : "partner_cleanup_failed",
      };
    }
    if (!error) {
      continue;
    }
    failures.push({ stage: operation.stage, error });
    logServerError("[partner-create] rollback failed", error, { stage: operation.stage });
  }

  if (failures.length > 0) {
    throw new Error("partner_create_cleanup_failed", {
      cause: { originalError: input.originalError, failures },
    });
  }
}
