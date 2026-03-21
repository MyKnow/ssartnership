"use client";

import { useMemo, useState } from "react";
import type { Category, CategoryKey, Partner } from "@/lib/types";
import CategoryTabs, { CategoryTabOption } from "@/components/CategoryTabs";
import PartnerCard from "@/components/PartnerCard";
import ThemeToggle from "@/components/ThemeToggle";
import SectionHeading from "@/components/ui/SectionHeading";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";

const suggestionUrl = process.env.NEXT_PUBLIC_MATTERMOST_DM_URL ?? "";

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
    if (!suggestionUrl) {
      return;
    }
    setSuggesting(true);
    window.location.href = suggestionUrl;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-6 py-4">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-foreground">
            SSARTNERSHIP
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setSuggestOpen(true)}>
              제안하기
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-16 pt-10">
        <section className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 px-8 py-10 text-white shadow-lg">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-300">
              SSAFY Partnership
            </p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight">
              캠퍼스 인근 제휴를 한눈에 보고,
              <br />
              합리적으로 이용하세요.
            </h2>
            <p className="mt-4 text-base text-slate-200">
              혜택, 연락처, 위치를
              빠르게 확인하세요.
            </p>
          </div>
        </section>

        <section className="mt-10 flex flex-col gap-6">
          <SectionHeading
            title="카테고리별 혜택"
            description="원하는 카테고리를 선택해보세요."
          />
          <CategoryTabs
            options={tabOptions}
            activeKey={activeCategory}
            onChange={setActiveCategory}
          />
        </section>

        <section className="mt-10">
          {filteredPartners.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
              <p className="text-sm text-muted-foreground">
                아직 등록된 제휴가 없습니다.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
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
      </main>

      <Modal
        open={isSuggestOpen}
        title="제휴 제안"
        description="제휴를 추진했으면 하는 카테고리나 업체가 있으신가요?"
        onClose={() => setSuggestOpen(false)}
      >
        <Button variant="ghost" onClick={() => setSuggestOpen(false)}>
          취소
        </Button>
        <Button onClick={handleSuggest} disabled={isSuggesting}>
          <span className="inline-flex items-center gap-2">
            {isSuggesting ? <Spinner /> : null}
            {isSuggesting ? "이동 중" : "제안하기"}
          </span>
        </Button>
      </Modal>
    </div>
  );
}
