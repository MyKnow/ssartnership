import { randomUUID } from "node:crypto";

export function buildPartnerCompanySlug(name: string) {
  const normalized = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 48);

  const base = normalized || "partner-company";
  return `${base}-${randomUUID().slice(0, 8)}`;
}
