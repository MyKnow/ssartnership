"use client";

import { useMemo, useState } from "react";
import type { Category, CategoryKey, Partner } from "@/lib/types";
import CategoryTabs, { CategoryTabOption } from "@/components/CategoryTabs";
import PartnerCard from "@/components/PartnerCard";
import ThemeToggle from "@/components/ThemeToggle";

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
    return new Map(categories.map((category) => [category.key, category.label]));
  }, [categories]);

  const filteredPartners = useMemo(() => {
    if (activeCategory === "all") {
      return partners;
    }
    return partners.filter((partner) => partner.category === activeCategory);
  }, [activeCategory, partners]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              SSAFY 15기 서울 캠퍼스
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
              제휴 혜택 카드뷰
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <a
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:text-slate-200"
              href="/admin"
            >
              Admin 관리
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-16 pt-10">
        <section className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 px-8 py-10 text-white shadow-lg">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-300">
              Partnership Board
            </p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight">
              역삼역 인근 제휴를 한눈에 보고,
              <br />
              합리적으로 이용하세요.
            </h2>
            <p className="mt-4 text-base text-slate-200">
              최신 제휴 정보를 카드뷰로 정리했습니다. 혜택, 연락처, 위치를
              빠르게 확인하고 운영진에게 문의해 주세요.
            </p>
          </div>
        </section>

        <section className="mt-10 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
              카테고리별 혜택
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              신규 카테고리는 Admin에서 추가될 예정입니다.
            </p>
          </div>
          <CategoryTabs
            options={tabOptions}
            activeKey={activeCategory}
            onChange={setActiveCategory}
          />
        </section>

        <section className="mt-10">
          {filteredPartners.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
              <p className="text-sm text-slate-500 dark:text-slate-400">
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
                    categoryMap.get(partner.category) ?? "알 수 없음"
                  }
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
