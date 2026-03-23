"use client";

import { useEffect, useMemo, useState } from "react";
import type { Category, CategoryKey, Partner } from "@/lib/types";
import PartnerFilters, {
  PartnerSortOption,
} from "@/components/PartnerFilters";
import PartnerCard from "@/components/PartnerCard";
import HeroSection from "@/components/HeroSection";
import SiteHeader from "@/components/SiteHeader";
import SectionHeading from "@/components/ui/SectionHeading";
import Container from "@/components/ui/Container";
import EmptyState from "@/components/ui/EmptyState";
import { HOME_COPY } from "@/lib/content";
import { compareEndDate, isWithinPeriod } from "@/lib/partner-utils";
import { useToast } from "@/components/ui/Toast";

export default function HomeView({
  categories,
  partners,
}: {
  categories: Category[];
  partners: Partner[];
}) {
  const [activeCategory, setActiveCategory] = useState<CategoryKey | "all">(
    "all",
  );
  const [searchValue, setSearchValue] = useState("");
  const [sortValue, setSortValue] = useState<PartnerSortOption>("recent");
  const { notify } = useToast();

  const categoryMap = useMemo(() => {
    return new Map(
      categories.map((category) => [
        category.key,
        { label: category.label, color: category.color },
      ]),
    );
  }, [categories]);

  const filteredPartners = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    const normalized = partners.map((partner, index) => ({
      ...partner,
      _index: index,
      _isActive: isWithinPeriod(partner.period.start, partner.period.end),
      _search: [
        partner.name,
        partner.location,
        partner.contact,
        partner.benefits.join(" "),
        (partner.conditions ?? []).join(" "),
        (partner.tags ?? []).join(" "),
      ]
        .join(" ")
        .toLowerCase(),
    }));

    const categoryFiltered =
      activeCategory === "all"
        ? normalized
        : normalized.filter((partner) => partner.category === activeCategory);

    const searchFiltered = query
      ? categoryFiltered.filter((partner) => partner._search.includes(query))
      : categoryFiltered;

    return [...searchFiltered].sort((a, b) => {
      if (a._isActive !== b._isActive) {
        return a._isActive ? -1 : 1;
      }
      if (sortValue === "endingSoon") {
        const compare = compareEndDate(a.period.end, b.period.end);
        if (compare !== 0) {
          return compare;
        }
      }
      return a._index - b._index;
    });
  }, [activeCategory, partners, searchValue, sortValue]);

  const renderLines = (value: string) => {
    const lines = value.split("\n");
    return lines.map((line, index) => (
      <span key={`${line}-${index}`}>
        {line}
        {index < lines.length - 1 ? <br /> : null}
      </span>
    ));
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const flag = sessionStorage.getItem("suggest:submitted");
    if (flag) {
      sessionStorage.removeItem("suggest:submitted");
      notify("정상적으로 제출되었습니다.");
    }
  }, [notify]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main>
        <Container className="pb-16 pt-10">
          <HeroSection
            eyebrow={HOME_COPY.heroEyebrow}
            title={HOME_COPY.heroTitle}
            description={renderLines(HOME_COPY.heroDescription)}
          />

          <section className="mt-10 flex flex-col gap-6" data-nosnippet>
            <SectionHeading
              title={HOME_COPY.categoryTitle}
              description={HOME_COPY.categoryDescription}
            />
            <PartnerFilters
              categories={categories}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              sortValue={sortValue}
              onSortChange={setSortValue}
            />
          </section>

          <section className="mt-10">
            {filteredPartners.length === 0 ? (
              <EmptyState
                title={
                  partners.length === 0
                    ? HOME_COPY.emptyTitle
                    : HOME_COPY.noResultsTitle
                }
                description={
                  partners.length === 0
                    ? HOME_COPY.emptyDescription
                    : HOME_COPY.noResultsDescription
                }
              />
            ) : (
              <div className="grid justify-items-center gap-x-4 gap-y-6 sm:grid-cols-2 sm:justify-items-stretch xl:grid-cols-3 xl:gap-x-6">
                {filteredPartners.map((partner) => (
                  <PartnerCard
                    key={partner.id}
                    partner={partner}
                    categoryLabel={
                      categoryMap.get(partner.category)?.label ?? "알 수 없음"
                    }
                    categoryColor={categoryMap.get(partner.category)?.color}
                    onCategoryClick={(categoryKey) =>
                      setActiveCategory(categoryKey)
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </Container>
      </main>

    </div>
  );
}
