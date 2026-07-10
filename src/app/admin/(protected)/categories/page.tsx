import { redirect } from "next/navigation";
import AdminCategoryManager from "@/components/admin/AdminCategoryManager";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminShell from "@/components/admin/AdminShell";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import StatsRow from "@/components/ui/StatsRow";
import {
  createCategory,
  updateCategory,
} from "@/app/admin/(protected)/actions";
import { adminActionErrorMessages } from "@/lib/admin-action-errors";
import { requireAdminPermission } from "@/lib/admin-access";
import { canAdmin } from "@/lib/admin-permissions";
import { isRegionalAdminAccount } from "@/lib/admin-scope";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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
  const errorMessage = params.error
    ? adminActionErrorMessages[params.error] ?? null
    : null;
  const supabase = getSupabaseAdminClient();
  const categoriesResult = await supabase
    .from("categories")
    .select("id,key,label,description,color")
    .order("created_at", { ascending: true });

  if (categoriesResult.error) {
    throw new Error(`category load failed: ${categoriesResult.error.message}`);
  }

  const categories = categoriesResult.data ?? [];
  const usageCountEntries = await Promise.all(
    categories.map(async (category) => {
      const { count, error } = await supabase
        .from("partners")
        .select("id", { count: "exact", head: true })
        .eq("category_id", category.id);

      if (error) {
        throw new Error(`category usage count failed: ${error.message}`);
      }

      return [category.id, count ?? 0] as const;
    }),
  );
  const usageCountById = Object.fromEntries(usageCountEntries);
  const describedCount = categories.filter((category) =>
    Boolean(category.description?.trim()),
  ).length;
  const coloredCount = categories.filter((category) =>
    Boolean(category.color?.trim()),
  ).length;

  return (
    <AdminShell title="카테고리" backHref="/admin/partners" backLabel="제휴처">
      <div className="grid min-w-0 gap-6">
        <AdminPageHeader
          eyebrow="Categories"
          title="카테고리 관리"
          description="사용자에게 보이는 제휴처 분류의 이름, 설명, 색상을 관리합니다."
          actions={
            <Button href="/admin/partners" variant="secondary">
              제휴처 목록
            </Button>
          }
        />
        <StatsRow
          items={[
            { label: "전체", value: `${categories.length.toLocaleString("ko-KR")}개`, hint: "운영 중인 분류" },
            { label: "설명 입력", value: `${describedCount.toLocaleString("ko-KR")}개`, hint: "사용자 안내 문구" },
            { label: "색상 설정", value: `${coloredCount.toLocaleString("ko-KR")}개`, hint: "카테고리 강조 색상" },
          ]}
          minItemWidth="13rem"
        />
        {errorMessage ? <FormMessage variant="error">{errorMessage}</FormMessage> : null}
        <AdminCategoryManager
          categories={categories}
          createAction={createCategory}
          updateAction={updateCategory}
          canCreate={canAdmin(adminSession.account.permissions, "brands", "create")}
          canUpdate={canAdmin(adminSession.account.permissions, "brands", "update")}
          usageCountById={usageCountById}
        />
      </div>
    </AdminShell>
  );
}
