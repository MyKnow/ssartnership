"use client";

import { useMemo, useState } from "react";
import type { Category, CategoryKey, Partner } from "@/lib/types";
import CategoryTabs, { CategoryTabOption } from "@/components/CategoryTabs";
import PartnerCard from "@/components/PartnerCard";
import HeroSection from "@/components/HeroSection";
import SiteHeader from "@/components/SiteHeader";
import SectionHeading from "@/components/ui/SectionHeading";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import Container from "@/components/ui/Container";
import { SUGGESTION_URL } from "@/lib/site";
import EmptyState from "@/components/ui/EmptyState";
import { HOME_COPY } from "@/lib/content";

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
  const [isSuggestOpen, setSuggestOpen] = useState(false);
  const [isSuggesting, setSuggesting] = useState(false);

  const tabOptions: CategoryTabOption[] = useMemo(() => {
    return [
      { key: "all", label: "전체", description: "모든 제휴" },
      ...categories.map((category) => ({
        key: category.key,
        label: category.label,
        description: category.description,
      })),
    ];
  }, [categories]);

  const categoryMap = useMemo(() => {
    return new Map(
      categories.map((category) => [
        category.key,
        { label: category.label, color: category.color },
      ]),
    );
  }, [categories]);

  const filteredPartners = useMemo(() => {
    if (activeCategory === "all") {
      return partners;
    }
    return partners.filter((partner) => partner.category === activeCategory);
  }, [activeCategory, partners]);

  const handleSuggest = () => {
    if (!SUGGESTION_URL) {
      return;
    }
    setSuggesting(true);
    window.location.href = SUGGESTION_URL;
  };

  const renderLines = (value: string) => {
    const lines = value.split("\n");
    return lines.map((line, index) => (
      <span key={`${line}-${index}`}>
        {line}
        {index < lines.length - 1 ? <br /> : null}
      </span>
    ));
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader onSuggest={() => setSuggestOpen(true)} />

      <main>
        <Container className="pb-16 pt-10">
          <HeroSection
            eyebrow={HOME_COPY.heroEyebrow}
            title={HOME_COPY.heroTitle}
            description={renderLines(HOME_COPY.heroDescription)}
          />

          <section className="mt-10 flex flex-col gap-6">
            <SectionHeading
              title={HOME_COPY.categoryTitle}
              description={HOME_COPY.categoryDescription}
            />
            <CategoryTabs
              options={tabOptions}
              activeKey={activeCategory}
              onChange={setActiveCategory}
            />
          </section>

          <section className="mt-10">
            {filteredPartners.length === 0 ? (
              <EmptyState
                title={HOME_COPY.emptyTitle}
                description={HOME_COPY.emptyDescription}
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
                  />
                ))}
              </div>
            )}
          </section>
        </Container>
      </main>

      <Modal
        open={isSuggestOpen}
        title={HOME_COPY.suggestionTitle}
        description={HOME_COPY.suggestionDescription}
        onClose={() => setSuggestOpen(false)}
      >
        <Button variant="ghost" onClick={() => setSuggestOpen(false)}>
          {HOME_COPY.suggestionCancel}
        </Button>
        <Button
          onClick={handleSuggest}
          disabled={isSuggesting || !SUGGESTION_URL}
        >
          <span className="inline-flex items-center gap-2">
            {isSuggesting ? <Spinner /> : null}
            {isSuggesting ? "이동 중" : HOME_COPY.suggestionPrimary}
          </span>
        </Button>
      </Modal>
    </div>
  );
}
