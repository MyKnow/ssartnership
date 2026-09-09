type PartnerCreateInsertError = {
  code?: string;
  message: string;
};

type ExistingPartnerLookup = {
  exists: boolean;
  error: { message: string } | null;
};

export type PartnerCreateInsertOutcome = "created" | "duplicate";

export async function resolvePartnerCreateInsertOutcome(input: {
  insertError: PartnerCreateInsertError | null;
  loadExistingPartner: () => Promise<ExistingPartnerLookup>;
  cleanupDuplicateAttempt: () => Promise<void>;
}): Promise<PartnerCreateInsertOutcome> {
  if (!input.insertError) {
    return "created";
  }
  if (input.insertError.code !== "23505") {
    throw new Error(input.insertError.message);
  }

  const existingPartner = await input.loadExistingPartner();
  if (existingPartner.error || !existingPartner.exists) {
    throw new Error(input.insertError.message);
  }

  await input.cleanupDuplicateAttempt();
  return "duplicate";
}
