import { notFound } from "next/navigation";
import { Suspense } from "react";
import AdminPartnerDetailEditSection, {
  AdminPartnerDetailEditSectionFallback,
} from "@/components/admin/AdminPartnerDetailEditSection";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminShell from "@/components/admin/AdminShell";
import AdminStatePanel from "@/components/admin/AdminStatePanel";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import { adminActionErrorMessages } from "@/lib/admin-action-errors";
import { requireAdminPermission } from "@/lib/admin-access";
import { canAdmin } from "@/lib/admin-permissions";
import {
  assertAdminCanAccessManagedCampuses,
  getManagedCampusFilterValues,
} from "@/lib/admin-scope";
import { getAdminPartnerDetailCoreReadModel } from "@/lib/admin-partner-detail.server";
import { partnerFormErrorMessages } from "@/lib/partner-form-errors";
import { sanitizeAdminReturnTo } from "@/lib/admin-session-bridge";

export const dynamic = "force-dynamic";

const adminPartnerEditErrorMessages: Record<string, string> = {
  ...partnerFormErrorMessages,
  ...adminActionErrorMessages,
};

function readFirstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function appendReturnTo(path: string, returnTo: string) {
  if (returnTo === "/admin/partners") {
    return path;
  }

  const params = new URLSearchParams({ returnTo });
  return `${path}?${params.toString()}`;
}

async function AdminPartnerDetailEditContent({
  adminSession,
  partnerId,
  query,
}: {
  adminSession: Awaited<ReturnType<typeof requireAdminPermission>>;
  partnerId: string;
  query: Record<string, string | string[] | undefined>;
}) {
  const managedCampusFilter = getManagedCampusFilterValues(
    adminSession.account,
  );
  const detailPath = `/admin/partners/${partnerId}`;
  const editPath = `${detailPath}/edit`;
  const returnTo = sanitizeAdminReturnTo(
    readFirstQueryValue(query.returnTo),
    "/admin/partners",
  );
  const detailHref = appendReturnTo(detailPath, returnTo);
  const retryHref = appendReturnTo(editPath, returnTo);
  const partnerError = query.error
    ? (adminPartnerEditErrorMessages[String(query.error)] ?? null)
    : null;
  const partnerSaved = query.success === "updated";
  const canUpdatePartner = canAdmin(
    adminSession.account.permissions,
    "brands",
    "update",
  );
  const detail = await getAdminPartnerDetailCoreReadModel({
    partnerId,
    includeEditFields: true,
  });

  if (detail.status === "not_found") {
    notFound();
  }
  if (detail.status === "error") {
    return (
      <AdminStatePanel
        kind="error"
        title="제휴처 수정 정보를 불러오지 못했습니다."
        description="잠시 후 다시 확인해 주세요. 문제가 계속되면 운영 기록을 확인해 주세요."
        action={
          <Button href={retryHref} variant="secondary">
            다시 확인
          </Button>
        }
      />
    );
  }

  const { partner } = detail;
  try {
    assertAdminCanAccessManagedCampuses(
      adminSession.account,
      (partner as { managed_campus_slugs?: string[] | null })
        .managed_campus_slugs,
    );
  } catch {
    notFound();
  }

  const thumbnail = partner.thumbnail ?? partner.images?.[0] ?? null;
  const galleryImages = partner.thumbnail
    ? (partner.images ?? [])
    : (partner.images ?? []).slice(1);

  return (
    <section className="grid min-w-0 gap-6">
      <AdminPageHeader
        eyebrow="제휴처 기본 정보"
        title={partner.name}
        description="공개 상태와 혜택 정보를 포함한 제휴처 기본 정보를 수정합니다. 저장 후 제휴처 상세 화면으로 돌아갑니다."
        actions={
          <Button href={detailHref} variant="secondary">
            제휴처 상세
          </Button>
        }
      />

      {partnerError ? (
        <FormMessage variant="error">{partnerError}</FormMessage>
      ) : null}
      {partnerSaved ? (
        <FormMessage variant="info">제휴처 정보를 저장했습니다.</FormMessage>
      ) : null}

      <Suspense fallback={<AdminPartnerDetailEditSectionFallback />}>
        <AdminPartnerDetailEditSection
          detail={detail}
          managedCampusSlugs={managedCampusFilter}
          canUpdatePartner={canUpdatePartner}
          partnerSaved={partnerSaved}
          detailPath={detailHref}
          retryHref={retryHref}
          thumbnail={thumbnail}
          galleryImages={galleryImages}
        />
      </Suspense>
    </section>
  );
}

export default async function AdminPartnerDetailEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const adminSession = await requireAdminPermission("brands", "read", {
    path: "/admin/partners",
  });
  const { partnerId } = await params;
  const query = (await searchParams) ?? {};
  const returnTo = sanitizeAdminReturnTo(
    readFirstQueryValue(query.returnTo),
    "/admin/partners",
  );

  return (
    <AdminShell
      title="제휴처 기본 정보 수정"
      backHref={appendReturnTo(`/admin/partners/${partnerId}`, returnTo)}
      backLabel="제휴처 상세"
    >
      <Suspense fallback={<AdminPartnerDetailEditSectionFallback />}>
        <AdminPartnerDetailEditContent
          adminSession={adminSession}
          partnerId={partnerId}
          query={query}
        />
      </Suspense>
    </AdminShell>
  );
}
