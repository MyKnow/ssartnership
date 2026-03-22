"use client";

import { useMemo, useState } from "react";
import type { CategoryKey } from "@/lib/types";
import PartnerCard from "@/components/PartnerCard";
import PartnerFilters, {
  PartnerSortOption,
} from "@/components/PartnerFilters";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import { ADMIN_COPY } from "@/lib/content";
import { compareEndDate, isWithinPeriod } from "@/lib/partner-utils";

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
  location: string;
  map_url?: string | null;
  contact: string;
  period_start?: string | null;
  period_end?: string | null;
  benefits?: string[] | null;
  conditions?: string[] | null;
  images?: string[] | null;
  tags?: string[] | null;
};

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
          partner.contact,
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

    const searchFiltered = query
      ? categoryFiltered.filter((partner) => partner._search.includes(query))
      : categoryFiltered;

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
  }, [activeCategory, categoryKeyById, partners, searchValue, sortValue]);

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

      {isCreateOpen ? (
        <PartnerCard
          mode="create"
          partner={{
            name: "",
            location: "",
            mapUrl: "",
            contact: "",
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
            <PartnerCard
              key={partner.id}
              mode="edit"
              partner={{
                id: partner.id,
                name: partner.name ?? "",
                location: partner.location ?? "",
                mapUrl: partner.map_url ?? "",
                contact: partner.contact ?? "",
                period: {
                  start: partner.period_start ?? "",
                  end: partner.period_end ?? "",
                },
                benefits: partner.benefits ?? [],
                conditions: partner.conditions ?? [],
                images: partner.images ?? [],
                tags: partner.tags ?? [],
              }}
              categoryOptions={categoryOptions}
              categoryId={partner.category_id ?? defaultCategoryId}
              formAction={updatePartner}
              deleteAction={deletePartner}
              submitLabel="수정"
            />
          ))}
        </div>
      )}
    </div>
  );
}
