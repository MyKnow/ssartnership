"use client";

import { useMemo, useState } from "react";
import type { CategoryKey } from "@/lib/types";
import PartnerCard from "@/components/PartnerCard";
import PartnerFilters, {
  PartnerSortOption,
} from "@/components/PartnerFilters";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { ADMIN_COPY } from "@/lib/content";
import { compareEndDate, isWithinPeriod } from "@/lib/partner-utils";
import AdminPartnerEditorCard from "@/components/admin/AdminPartnerEditorCard";

type AdminCategory = {
  id: string;
  key: string;
  label: string;
  description?: string | null;
  color?: string | null;
};

type AdminPartner = {
  id: string;
  name: string;
  category_id: string;
  visibility: "public" | "confidential" | "private";
  location: string;
  map_url?: string | null;
  reservation_link?: string | null;
  inquiry_link?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  benefits?: string[] | null;
  conditions?: string[] | null;
  images?: string[] | null;
  tags?: string[] | null;
};

type VisibilityFilter = "all" | "public" | "confidential" | "private";

export default function AdminPartnerManager({
  categories,
  partners,
  createPartner,
  updatePartner,
  deletePartner,
}: {
  categories: AdminCategory[];
  partners: AdminPartner[];
  createPartner: (formData: FormData) => void | Promise<void>;
  updatePartner: (formData: FormData) => void | Promise<void>;
  deletePartner: (formData: FormData) => void | Promise<void>;
}) {
  const [activeCategory, setActiveCategory] = useState<CategoryKey | "all">(
    "all",
  );
  const [visibilityFilter, setVisibilityFilter] =
    useState<VisibilityFilter>("all");
  const [searchValue, setSearchValue] = useState("");
  const [sortValue, setSortValue] = useState<PartnerSortOption>("recent");
  const [isCreateOpen, setCreateOpen] = useState(false);

  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        id: category.id,
        label: category.label,
        key: category.key,
        description: category.description ?? "",
      })),
    [categories],
  );

  const categoryKeyById = useMemo(() => {
    return new Map(categories.map((category) => [category.id, category.key]));
  }, [categories]);

  const filteredPartners = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    const normalized = partners.map((partner, index) => {
      const categoryKey = categoryKeyById.get(partner.category_id) ?? "unknown";
      const benefits = partner.benefits ?? [];
      const conditions = partner.conditions ?? [];
      const tags = partner.tags ?? [];

      return {
        ...partner,
        _index: index,
        _categoryKey: categoryKey,
        _isActive: isWithinPeriod(partner.period_start, partner.period_end),
        _search: [
          partner.name,
          partner.location,
          partner.reservation_link ?? "",
          partner.inquiry_link ?? "",
          partner.reservation_link,
          partner.inquiry_link,
          benefits.join(" "),
          conditions.join(" "),
          tags.join(" "),
        ]
          .join(" ")
          .toLowerCase(),
      };
    });

    const categoryFiltered =
      activeCategory === "all"
        ? normalized
        : normalized.filter((partner) => partner._categoryKey === activeCategory);

    const visibilityFiltered =
      visibilityFilter === "all"
        ? categoryFiltered
        : categoryFiltered.filter(
            (partner) => partner.visibility === visibilityFilter,
          );

    const searchFiltered = query
      ? visibilityFiltered.filter((partner) => partner._search.includes(query))
      : visibilityFiltered;

    return [...searchFiltered].sort((a, b) => {
      if (a._isActive !== b._isActive) {
        return a._isActive ? -1 : 1;
      }
      if (sortValue === "endingSoon") {
        const compare = compareEndDate(a.period_end, b.period_end);
        if (compare !== 0) {
          return compare;
        }
      }
      return a._index - b._index;
    });
  }, [activeCategory, categoryKeyById, partners, searchValue, sortValue, visibilityFilter]);

  const defaultCategoryId = categoryOptions[0]?.id ?? "";
  const canCreate = categoryOptions.length > 0;

  return (
    <div className="mt-6 grid gap-6">
      <PartnerFilters
        categories={categoryOptions.map((category) => ({
          key: category.key,
          label: category.label,
          description: category.description,
        }))}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        sortValue={sortValue}
        onSortChange={setSortValue}
      />

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-muted p-4 md:flex-row md:items-end md:justify-between">
        <div className="grid gap-1 md:w-56">
          <span className="text-xs font-medium text-muted-foreground">
            노출 상태
          </span>
          <Select
            value={visibilityFilter}
            onChange={(event) =>
              setVisibilityFilter(event.target.value as VisibilityFilter)
            }
          >
            <option value="all">전체</option>
            <option value="public">공개</option>
            <option value="confidential">대외비</option>
            <option value="private">비공개</option>
          </Select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            총 {partners.length}개 제휴
          </p>
          <Button
            variant="ghost"
            onClick={() => setCreateOpen((prev) => !prev)}
            disabled={!canCreate}
          >
            {isCreateOpen ? "추가 폼 닫기" : "제휴 업체 추가"}
          </Button>
        </div>
      </div>

      {isCreateOpen ? (
        <PartnerCard
          mode="create"
          partner={{
            name: "",
            visibility: "public",
            location: "",
            mapUrl: "",
            reservationLink: "",
            inquiryLink: "",
            period: { start: "", end: "" },
            benefits: [],
            conditions: [],
            images: [],
            tags: [],
          }}
          categoryOptions={categoryOptions}
          categoryId={defaultCategoryId}
          formAction={createPartner}
          submitLabel="제휴 추가"
          className="bg-surface"
        />
      ) : null}

      {filteredPartners.length === 0 ? (
        <EmptyState
          title={
            partners.length === 0
              ? ADMIN_COPY.emptyPartnerTitle
              : ADMIN_COPY.noResultsTitle
          }
          description={
            partners.length === 0
              ? ADMIN_COPY.emptyPartnerDescription
              : ADMIN_COPY.noResultsDescription
          }
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {filteredPartners.map((partner) => (
            <AdminPartnerEditorCard
              key={partner.id}
              partner={partner}
              categoryOptions={categoryOptions}
              formAction={updatePartner}
              deleteAction={deletePartner}
            />
          ))}
        </div>
      )}
    </div>
  );
}
