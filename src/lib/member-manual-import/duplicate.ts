export type ManualMemberImportDuplicateKind = "mattermost" | "email";

export function getManualMemberImportDuplicateKind(
  error: unknown,
): ManualMemberImportDuplicateKind | null {
  if (!error || typeof error !== "object" || !("message" in error)) {
    return null;
  }
  const message = (error as { message?: unknown }).message;
  if (message === "existing_mattermost") return "mattermost";
  if (message === "existing_email") return "email";
  return null;
}
