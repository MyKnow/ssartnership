export function isMissingSupabasePoolerTenantErrorMessage(message) {
  const normalized = String(message ?? "").toLowerCase();

  return (
    normalized.includes("tenant/user") &&
    normalized.includes("not found") &&
    normalized.includes("enotfound")
  );
}
