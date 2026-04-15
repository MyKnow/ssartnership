"use client";

import { useMemo, useState } from "react";
import type { CategoryKey } from "@/lib/types";
import type { PartnerSortOption } from "@/components/PartnerFilters";
import AdminPartnerManagerFilters from "@/components/admin/partner-manager/AdminPartnerManagerFilters";
import AdminPartnerManagerList from "@/components/admin/partner-manager/AdminPartnerManagerList";
import {
  buildCategoryKeyById,
  createAdminPartnerCategoryOptions,
  createAdminPartnerCompanyOptions,
  filterAndSortAdminPartners,
} from "@/components/admin/partner-manager/selectors";
import type {
  AdminCategory,
  AdminCompany,
  AdminPartner,
  VisibilityFilter,
} from "@/components/admin/partner-manager/types";

export type {
  AdminCategory,
  AdminCompany,
  AdminPartner,
  VisibilityFilter,
} from "@/components/admin/partner-manager/types";
export {
  buildCategoryKeyById,
  createAdminPartnerCategoryOptions,
  createAdminPartnerCompanyOptions,
  filterAndSortAdminPartners,
} from "@/components/admin/partner-manager/selectors";

export default function AdminPartnerManager({
  categories,
  partners,
  companies,
  updatePartner,
  deletePartner,
}: {
  categories: AdminCategory[];
  partners: AdminPartner[];
  companies: AdminCompany[];
  updatePartner: (formData: FormData) => void | Promise<void>;
  deletePartner: (formData: FormData) => void | Promise<void>;
}) {
  const [activeCategory, setActiveCategory] = useState<CategoryKey | "all">("all");
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all");
  const [searchValue, setSearchValue] = useState("");
  const [sortValue, setSortValue] = useState<PartnerSortOption>("recent");

  const categoryOptions = useMemo(
    () => createAdminPartnerCategoryOptions(categories),
    [categories],
  );
  const companyOptions = useMemo(
    () => createAdminPartnerCompanyOptions(companies),
    [companies],
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

  return (
    <div className="mt-6 grid gap-6">
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
        categoryOptions={categoryOptions}
        companyOptions={companyOptions}
        updatePartner={updatePartner}
        deletePartner={deletePartner}
      />
    </div>
  );
}
