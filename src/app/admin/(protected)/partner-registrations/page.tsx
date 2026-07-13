import AdminPartnerRegistrationsView, {
  type AdminPartnerRegistrationRow,
} from "@/components/admin/AdminPartnerRegistrationsView";
import { updatePartnerRegistrationRequestStatus } from "@/app/admin/(protected)/partner-registrations/actions";
import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPermission } from "@/lib/admin-access";
import {
  canAdminAccessManagedCampuses,
  getManagedCampusFilterValues,
} from "@/lib/admin-scope";
import { inferCampusSlugsFromLocation } from "@/lib/campuses";
import { isPartnerRegistrationRequestStatus } from "@/lib/partner-registration";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPartnerRegistrationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const adminSession = await requireAdminPermission("brands", "read", {
    path: "/admin/partner-registrations",
  });
  const managedCampusFilter = getManagedCampusFilterValues(adminSession.account);
  const params = (await searchParams) ?? {};
  const status =
    params.status && isPartnerRegistrationRequestStatus(params.status)
      ? params.status
      : null;

  let query = getSupabaseAdminClient()
    .from("partner_registration_requests")
    .select(
      "*,company:partner_companies(managed_campus_slugs),branches:partner_registration_branches(id,branch_type,campus_slugs),benefit_groups:partner_registration_benefit_groups(id,group_key,label)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`partner registration request load failed: ${error.message}`);
  }

  const rows = ((data ?? []) as AdminPartnerRegistrationRow[]).filter((row) => {
    if (!managedCampusFilter) return true;
    const company = Array.isArray(row.company) ? row.company[0] : row.company;
    const managedCampusSlugs =
      company?.managed_campus_slugs ??
      inferCampusSlugsFromLocation(row.location);
    return canAdminAccessManagedCampuses(
      adminSession.account,
      managedCampusSlugs,
    );
  });

  return (
    <AdminShell
      title="제휴 등록 신청"
      backHref="/admin/partners"
      backLabel="제휴처"
    >
      <AdminPartnerRegistrationsView
        rows={rows}
        updateStatusAction={updatePartnerRegistrationRequestStatus}
      />
    </AdminShell>
  );
}
