import { z } from "zod";
import { canAdmin, type AdminPermissionResource } from "../admin-permissions.ts";
import { isRegionalAdminAccount } from "../admin-scope.ts";
import type { AdminAccount } from "../admin-accounts.ts";
import type { PartnerRepository } from "../repositories/partner-repository.ts";
import type { ProjectShowcaseRepository } from "../project-showcase/repository.ts";
import { ShowcaseDomainError } from "../project-showcase/errors.ts";
import { buildPartnerDirectorySearchText } from "../public-partner-directory.ts";
import type { Partner } from "../types.ts";

/** Trusted transport context AFTER token/audience/expiry/revocation verification.
 * Never deserialize this from tool arguments. This module is not a token verifier.
 */
export type McpPrincipal = {
  adminId: string;
  permissionVersion: number;
  scopes: readonly string[];
};
export type McpReadDependencies = {
  /** Must perform a fresh account read; do not reuse a session/account cache. */
  getAdminAccount(id: string): Promise<AdminAccount | null>;
  partners: Pick<PartnerRepository, "getPublicDirectoryPartners" | "getPartnerById">;
  showcase: Pick<ProjectShowcaseRepository, "listOwnerFeedback">;
};
type FailureCode = "unauthorized" | "forbidden" | "invalid_input" | "not_found" | "unavailable";
type Result<T> = { ok: true; data: T } | { ok: false; code: FailureCode };
const pageShape = { limit: z.number().int().min(1).max(100).default(20), offset: z.number().int().min(0).max(10000).default(0) };
export const searchSchema = z.strictObject({ query: z.string().trim().max(120).default(""), category: z.string().trim().min(1).max(80).optional(), ...pageShape });
// Existing mock repositories use opaque synthetic ids; Supabase validates UUIDs.
const entityIdSchema = z.string().min(1).max(120).regex(/^[a-z0-9][a-z0-9_-]*$/i);
export const partnerSchema = z.strictObject({ partnerId: entityIdSchema });
export const feedbackSchema = z.strictObject({ projectId: entityIdSchema, ...pageShape });

// Explicit DTO, never return the repository model (URLs, ledgers and future fields).
function catalogItem(partner: Partner) {
  return {
    id: partner.id, name: partner.name, category: partner.category,
    location: partner.location, campusSlugs: [...(partner.campusSlugs ?? [])],
    benefits: partner.benefitAccessStatus ? [] : [...partner.benefits],
    benefitAccessStatus: partner.benefitAccessStatus ?? null,
    appliesTo: [...partner.appliesTo], period: { ...partner.period },
  };
}
function page<T>(items: T[], offset: number, limit: number) {
  return { items: items.slice(offset, offset + limit), nextOffset: items.length > offset + limit ? offset + limit : null };
}

export function createMcpReadService(dependencies: McpReadDependencies) {
  async function authorize(principal: McpPrincipal, scope: string, resource: AdminPermissionResource): Promise<Result<AdminAccount>> {
    const account = await dependencies.getAdminAccount(principal.adminId);
    if (!account || account.id !== principal.adminId || !account.isActive || account.mustChangePassword || account.permissionVersion !== principal.permissionVersion) {
      return { ok: false, code: "unauthorized" };
    }
    if (!principal.scopes.includes(scope) || !canAdmin(account.permissions, resource, "read") || (resource === "events" && isRegionalAdminAccount(account))) {
      return { ok: false, code: "forbidden" };
    }
    return { ok: true, data: account };
  }
  async function safely<T>(run: () => Promise<Result<T>>): Promise<Result<T>> {
    try { return await run(); } catch (error) {
      if (error instanceof ShowcaseDomainError && error.code === "project_not_found") return { ok: false, code: "not_found" };
      return { ok: false, code: "unavailable" };
    }
  }
  return {
    searchPartners(principal: McpPrincipal, input: unknown) {
      return safely(async () => {
        const auth = await authorize(principal, "catalog:read", "brands");
        if (!auth.ok) return auth;
        const parsed = searchSchema.safeParse(input);
        if (!parsed.success) return { ok: false, code: "invalid_input" };
        const { query, category, limit, offset } = parsed.data;
        const partners = await dependencies.partners.getPublicDirectoryPartners({ authenticated: false });
        const items = partners.filter((partner) => partner.visibility === "public")
          .filter((partner) => !category || partner.category === category)
          .filter((partner) => !query || buildPartnerDirectorySearchText({ ...partner, benefits: partner.benefitAccessStatus ? [] : [...partner.benefits], conditions: [], reservationLink: undefined, inquiryLink: undefined }).includes(query.toLowerCase()))
          .sort((a, b) => a.name.localeCompare(b.name, "ko") || a.id.localeCompare(b.id))
          .map(catalogItem);
        return { ok: true, data: page(items, offset, limit) };
      });
    },
    getPartner(principal: McpPrincipal, input: unknown) {
      return safely(async () => {
        const auth = await authorize(principal, "catalog:read", "brands");
        if (!auth.ok) return auth;
        const parsed = partnerSchema.safeParse(input);
        if (!parsed.success) return { ok: false, code: "invalid_input" };
        const partner = await dependencies.partners.getPartnerById(parsed.data.partnerId, { authenticated: false });
        if (!partner || partner.visibility !== "public") return { ok: false, code: "not_found" };
        return { ok: true, data: catalogItem(partner) };
      });
    },
    listOwnFeedback(principal: McpPrincipal, input: unknown) {
      return safely(async () => {
        const auth = await authorize(principal, "showcase:own-feedback:read", "events");
        if (!auth.ok) return auth;
        const parsed = feedbackSchema.safeParse(input);
        if (!parsed.success) return { ok: false, code: "invalid_input" };
        const { projectId, offset, limit } = parsed.data;
        // Ownership/hidden status are enforced by the SAME mock/Supabase method as the owner page.
        const feedback = await dependencies.showcase.listOwnerFeedback(auth.data.id, projectId);
        return { ok: true, data: page(feedback.map(({ body }) => ({ body })), offset, limit) };
      });
    },
  };
}
