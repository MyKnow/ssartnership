import { Suspense } from "react";
import AdminShell from "@/components/admin/AdminShell";
import AdminPartnerNewView from "@/components/admin/AdminPartnerNewView";
import AdminStatePanel from "@/components/admin/AdminStatePanel";
import Button from "@/components/ui/Button";
import { AdminPartnerNewSkeletonContent } from "@/components/loading/AdminPageSkeletons";
import { createPartnerFormAction } from "@/app/admin/(protected)/actions";
import { parseAdminPartnerXlsxFileAction } from "@/app/admin/(protected)/partners/new/actions";
import { requireAdminPermission } from "@/lib/admin-access";
import { getManagedCampusFilterValues } from "@/lib/admin-scope";
import { getAdminPartnerFormOptionsReadModel } from "@/lib/admin-partner-form-options.server";
import { CAMPUS_SLUGS } from "@/lib/campuses";

export const dynamic = "force-dynamic";

async function AdminPartnerNewContent({
  adminSession,
}: {
  adminSession: Awaited<ReturnType<typeof requireAdminPermission>>;
}) {
  const managedCampusFilter = getManagedCampusFilterValues(adminSession.account);
  const options = await getAdminPartnerFormOptionsReadModel({
    managedCampusSlugs: managedCampusFilter,
  });
  const { categories, companies } = options;
  const defaultCategoryId = categories[0]?.id ?? "";
  const defaultCampusSlugs =
    managedCampusFilter ?? [...CAMPUS_SLUGS];

  return options.loadError ? (
        <AdminStatePanel
          kind="error"
          title="제휴처 생성에 필요한 옵션을 불러오지 못했습니다."
          description="잠시 후 다시 확인해 주세요. 문제가 계속되면 운영 기록을 확인해 주세요."
          action={<Button href="/admin/partners/new" variant="secondary">다시 확인</Button>}
        />
      ) : (
        <AdminPartnerNewView
          partner={{
            name: "",
            visibility: "public",
            benefitVisibility: "public",
            location: "",
            detailDescription: "",
            campusSlugs: defaultCampusSlugs,
            mapUrl: "",
            benefitActionType: "none",
            benefitActionLink: "",
            reservationLink: "",
            inquiryLink: "",
            period: { start: "", end: "" },
            conditions: [],
            benefits: [],
            appliesTo: [],
            thumbnail: null,
            images: [],
            tags: [],
            company: null,
          }}
          categoryOptions={categories.map((category) => ({
            id: category.id,
            key: category.key,
            label: category.label,
          }))}
          companyOptions={companies}
          categoryId={defaultCategoryId}
          createAction={createPartnerFormAction}
          parseFileAction={parseAdminPartnerXlsxFileAction}
        />
      );
}

export default async function AdminPartnerNewPage() {
  const adminSession = await requireAdminPermission("brands", "create", {
    path: "/admin/partners/new",
  });

  return (
    <AdminShell
      title="제휴처 추가"
      backHref="/admin/partners"
      backLabel="제휴처"
    >
      <Suspense fallback={<AdminPartnerNewSkeletonContent />}>
        <AdminPartnerNewContent adminSession={adminSession} />
      </Suspense>
    </AdminShell>
  );
}
