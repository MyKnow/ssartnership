"use client";

import { useMemo, useState } from "react";
import type { CategoryKey } from "@/lib/types";
import PartnerCardForm from "@/components/PartnerCardForm";
import PartnerFilters, {
  PartnerSortOption,
} from "@/components/PartnerFilters";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { ADMIN_COPY } from "@/lib/content";
import { compareEndDate, isWithinPeriod } from "@/lib/partner-utils";
import AdminPartnerEditorCard from "@/components/admin/AdminPartnerEditorCard";
import {
  DEFAULT_PARTNER_AUDIENCE,
  getPartnerAudienceLabel,
  normalizePartnerAudience,
} from "@/lib/partner-audience";

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
  company_id?: string | null;
  visibility: "public" | "confidential" | "private";
  location: string;
  map_url?: string | null;
  reservation_link?: string | null;
  inquiry_link?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  conditions?: string[] | null;
  benefits?: string[] | null;
  applies_to?: string[] | null;
  thumbnail?: string | null;
  images?: string[] | null;
  tags?: string[] | null;
  company?:
    | {
        id: string;
        name: string;
        slug: string;
        description?: string | null;
        contact_name?: string | null;
        contact_email?: string | null;
        contact_phone?: string | null;
        is_active?: boolean | null;
      }
    | null;
};

type AdminCompany = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  is_active?: boolean | null;
};

type VisibilityFilter = "all" | "public" | "confidential" | "private";

export default function AdminPartnerManager({
  categories,
  partners,
  companies,
  createPartner,
  updatePartner,
  deletePartner,
}: {
  categories: AdminCategory[];
  partners: AdminPartner[];
  companies: AdminCompany[];
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

  const companyOptions = useMemo(
    () =>
      companies.map((company) => ({
        id: company.id,
        name: company.name,
        slug: company.slug,
        contactName: company.contact_name ?? "",
        contactEmail: company.contact_email ?? "",
      })),
    [companies],
  );

  const categoryKeyById = useMemo(() => {
    return new Map(categories.map((category) => [category.id, category.key]));
  }, [categories]);

  const filteredPartners = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    const normalized = partners.map((partner, index) => {
      const categoryKey = categoryKeyById.get(partner.category_id) ?? "unknown";
      const conditions = partner.conditions ?? [];
      const benefits = partner.benefits ?? [];
      const appliesTo = normalizePartnerAudience(partner.applies_to);
      const tags = partner.tags ?? [];

      return {
        ...partner,
        _index: index,
        _categoryKey: categoryKey,
        _isActive: isWithinPeriod(partner.period_start, partner.period_end),
        _search: [
          partner.name,
          partner.company?.name ?? "",
          partner.company?.contact_email ?? "",
          partner.location,
          partner.reservation_link ?? "",
          partner.inquiry_link ?? "",
          conditions.join(" "),
          partner.reservation_link,
          partner.inquiry_link,
          benefits.join(" "),
          appliesTo.map((item) => getPartnerAudienceLabel(item)).join(" "),
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
        <PartnerCardForm
          mode="create"
          partner={{
            name: "",
            visibility: "public",
            location: "",
            mapUrl: "",
            reservationLink: "",
            inquiryLink: "",
            period: { start: "", end: "" },
            conditions: [],
            benefits: [],
            appliesTo: DEFAULT_PARTNER_AUDIENCE,
            thumbnail: null,
            images: [],
            tags: [],
            company: null,
          }}
          categoryOptions={categoryOptions}
          companyOptions={companyOptions}
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
        <div className="grid gap-6">
          {filteredPartners.map((partner) => (
              <AdminPartnerEditorCard
              key={partner.id}
              partner={partner}
              categoryOptions={categoryOptions}
              companyOptions={companyOptions}
              formAction={updatePartner}
              deleteAction={deletePartner}
            />
          ))}
        </div>
      )}
    </div>
  );
}
