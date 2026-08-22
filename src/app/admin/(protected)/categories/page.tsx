import { redirect } from "next/navigation";
import { Suspense } from "react";
import AdminCategoryManager from "@/components/admin/AdminCategoryManager";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminWorkspaceSummary from "@/components/admin/AdminWorkspaceSummary";
import AdminShell from "@/components/admin/AdminShell";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import AdminStatePanel from "@/components/admin/AdminStatePanel";
import {
  createCategory,
  updateCategory,
} from "@/app/admin/(protected)/actions";
import { adminActionErrorMessages } from "@/lib/admin-action-errors";
import { requireAdminPermission } from "@/lib/admin-access";
import { canAdmin } from "@/lib/admin-permissions";
import { getAdminCategoryReadModel } from "@/lib/admin-category-read-model.server";
import { isRegionalAdminAccount } from "@/lib/admin-scope";
import { AdminCategoriesSkeletonContent } from "@/components/loading/AdminPageSkeletons";

export const dynamic = "force-dynamic";

async function AdminCategoriesContent({
  adminSession,
  params,
  showHeader = true,
}: {
  adminSession: Awaited<ReturnType<typeof requireAdminPermission>>;
  params: { error?: string };
  showHeader?: boolean;
}) {
  const errorMessage = params.error
    ? adminActionErrorMessages[params.error] ?? null
    : null;
  const categoryReadModel = await getAdminCategoryReadModel();
  const { categories, usageCountById } = categoryReadModel;
  const describedCount = categories.filter((category) =>
    Boolean(category.description?.trim()),
  ).length;
  const coloredCount = categories.filter((category) =>
    Boolean(category.color?.trim()),
  ).length;

  return (
    <div className="grid min-w-0 gap-6">
        {showHeader ? (
          <AdminPageHeader
            eyebrow="데이터"
            title="카테고리 관리"
            description="사용자에게 보이는 제휴처 분류의 이름, 설명, 색상을 관리합니다."
            actions={
              <Button href="/admin/partners" variant="secondary">
                제휴처 목록
              </Button>
            }
          />
        ) : null}
        {errorMessage ? <FormMessage variant="error">{errorMessage}</FormMessage> : null}
        {categoryReadModel.loadError ? (
          <AdminStatePanel
            kind="error"
            title="카테고리 정보를 불러오지 못했습니다."
            description="잠시 후 다시 확인해 주세요. 문제가 계속되면 운영 기록을 확인해 주세요."
            action={<Button href="/admin/categories" variant="secondary">다시 확인</Button>}
          />
        ) : (
          <>
            <AdminWorkspaceSummary
              eyebrow="데이터"
              title="분류 운영 현황"
              description="사용 중인 카테고리와 입력 품질을 확인한 뒤 이름·설명·색상을 저장합니다."
              items={[
                { label: "전체", value: `${categories.length.toLocaleString("ko-KR")}개`, detail: "운영 중인 분류" },
                { label: "설명 입력", value: `${describedCount.toLocaleString("ko-KR")}개`, detail: "사용자 안내 문구" },
                { label: "색상 설정", value: `${coloredCount.toLocaleString("ko-KR")}개`, detail: "카테고리 강조 색상" },
              ]}
            />
            <AdminCategoryManager
              categories={categories}
              createAction={createCategory}
              updateAction={updateCategory}
              canCreate={canAdmin(adminSession.account.permissions, "brands", "create")}
              canUpdate={canAdmin(adminSession.account.permissions, "brands", "update")}
              usageCountById={usageCountById}
            />
          </>
        )}
    </div>
  );
}

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const adminSession = await requireAdminPermission("brands", "read", {
    path: "/admin/categories",
  });

  if (isRegionalAdminAccount(adminSession.account)) {
    redirect("/admin/partners");
  }

  const params = (await searchParams) ?? {};

  return (
    <AdminShell title="카테고리" backHref="/admin/partners" backLabel="제휴처">
      <div className="grid min-w-0 gap-6">
        <AdminPageHeader
          eyebrow="데이터"
          title="카테고리 관리"
          description="사용자에게 보이는 제휴처 분류의 이름, 설명, 색상을 관리합니다."
          actions={
            <Button href="/admin/partners" variant="secondary">
              제휴처 목록
            </Button>
          }
        />
        <Suspense fallback={<AdminCategoriesSkeletonContent showHeader={false} />}>
          <AdminCategoriesContent
            adminSession={adminSession}
            params={params}
            showHeader={false}
          />
        </Suspense>
      </div>
    </AdminShell>
  );
}
