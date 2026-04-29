"use client";

import { useMemo, useState } from "react";
import type { CategoryKey } from "@/lib/types";
import type { PartnerSortOption } from "@/components/PartnerFilters";
import AdminPartnerManagerFilters from "@/components/admin/partner-manager/AdminPartnerManagerFilters";
import AdminPartnerManagerList from "@/components/admin/partner-manager/AdminPartnerManagerList";
import {
  buildCategoryKeyById,
  createAdminPartnerCategoryOptions,
  filterAndSortAdminPartners,
} from "@/components/admin/partner-manager/selectors";
import type {
  AdminCategory,
  AdminPartner,
  VisibilityFilter,
} from "@/components/admin/partner-manager/types";

export type {
  AdminCategory,
  AdminPartner,
  VisibilityFilter,
} from "@/components/admin/partner-manager/types";
export {
  buildCategoryKeyById,
  createAdminPartnerCategoryOptions,
  filterAndSortAdminPartners,
} from "@/components/admin/partner-manager/selectors";

export default function AdminPartnerManager({
  categories,
  partners,
}: {
  categories: AdminCategory[];
  partners: AdminPartner[];
}) {
  const [activeCategory, setActiveCategory] = useState<CategoryKey | "all">("all");
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all");
  const [searchValue, setSearchValue] = useState("");
  const [sortValue, setSortValue] = useState<PartnerSortOption>("recent");

  const categoryOptions = useMemo(
    () => createAdminPartnerCategoryOptions(categories),
    [categories],
  );
  const categoryKeyById = useMemo(() => buildCategoryKeyById(categories), [categories]);
  const filteredPartners = useMemo(
    () =>
      filterAndSortAdminPartners({
        partners,
        categoryKeyById,
        activeCategory,
        visibilityFilter,
        searchValue,
        sortValue,
      }),
    [activeCategory, categoryKeyById, partners, searchValue, sortValue, visibilityFilter],
  );
  const publicCount = filteredPartners.filter((partner) => partner.visibility === "public").length;
  const confidentialCount = filteredPartners.filter((partner) => partner.visibility === "confidential").length;
  const privateCount = filteredPartners.filter((partner) => partner.visibility === "private").length;

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border/70 bg-surface-muted/60 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">필터 결과</p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">{filteredPartners.length.toLocaleString()}개</p>
          <p className="mt-1 text-sm text-muted-foreground">현재 검색/카테고리/정렬 기준 결과</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-surface-muted/60 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">공개</p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">{publicCount.toLocaleString()}개</p>
          <p className="mt-1 text-sm text-muted-foreground">사용자 화면 노출 상태</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-surface-muted/60 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">대외비</p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">{confidentialCount.toLocaleString()}개</p>
          <p className="mt-1 text-sm text-muted-foreground">운영 확인용 비공개 상태</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-surface-muted/60 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">비공개</p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">{privateCount.toLocaleString()}개</p>
          <p className="mt-1 text-sm text-muted-foreground">완전 비노출 상태</p>
        </div>
      </div>

      <AdminPartnerManagerFilters
        categoryOptions={categoryOptions.map((category) => ({
          key: category.key,
          label: category.label,
          description: category.description,
        }))}
        partnersCount={partners.length}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        searchValue={searchValue}
        setSearchValue={setSearchValue}
        sortValue={sortValue}
        setSortValue={setSortValue}
        visibilityFilter={visibilityFilter}
        setVisibilityFilter={setVisibilityFilter}
      />

      <AdminPartnerManagerList
        partners={partners}
        filteredPartners={filteredPartners}
        categories={categories}
      />
    </div>
  );
}
