"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { Category, CategoryKey, Partner } from "@/lib/types";

const emptyForm = {
  name: "",
  category: "health" as CategoryKey,
  location: "",
  mapUrl: "",
  contact: "",
  periodStart: "",
  periodEnd: "",
  benefits: "",
  tags: "",
};

export default function AdminView({
  categories,
  partners,
}: {
  categories: Category[];
  partners: Partner[];
}) {
  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState(partners);

  const categoryMap = useMemo(() => {
    return new Map(categories.map((category) => [category.key, category.label]));
  }, [categories]);

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.name || !form.location || !form.contact) {
      return;
    }

    const nextItem: Partner = {
      id: `${form.category}-${Date.now()}`,
      name: form.name,
      category: form.category,
      location: form.location,
      mapUrl: form.mapUrl || undefined,
      contact: form.contact,
      period: {
        start: form.periodStart || "미정",
        end: form.periodEnd || "미정",
      },
      benefits: form.benefits
        ? form.benefits.split(",").map((item) => item.trim())
        : ["협의 중"],
      tags: form.tags
        ? form.tags.split(",").map((item) => item.trim())
        : [],
    };

    setItems((prev) => [nextItem, ...prev]);
    setForm(emptyForm);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              SSAFY 15기 운영
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">
              Admin 제휴 관리
            </h1>
          </div>
          <a
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
            href="/"
          >
            사용자 화면
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-16 pt-10">
        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <form
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            onSubmit={handleSubmit}
          >
            <h2 className="text-lg font-semibold text-slate-900">
              신규 제휴 등록
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              실제 저장은 Supabase 연동 후 가능합니다.
            </p>

            <div className="mt-6 flex flex-col gap-4">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                업체명
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="예: 역삼역 헬스장"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                카테고리
                <select
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                >
                  {categories.map((category) => (
                    <option key={category.key} value={category.key}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                위치
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  placeholder="예: 서울 강남구 테헤란로 00"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                지도 URL
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  name="mapUrl"
                  value={form.mapUrl}
                  onChange={handleChange}
                  placeholder="https://map.kakao.com/..."
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                연락처
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  name="contact"
                  value={form.contact}
                  onChange={handleChange}
                  placeholder="02-000-0000"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  시작일
                  <input
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    name="periodStart"
                    value={form.periodStart}
                    onChange={handleChange}
                    placeholder="2026-03-01"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  종료일
                  <input
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    name="periodEnd"
                    value={form.periodEnd}
                    onChange={handleChange}
                    placeholder="2026-08-31"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                혜택
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  name="benefits"
                  value={form.benefits}
                  onChange={handleChange}
                  placeholder="콤마(,)로 구분"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                태그
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  name="tags"
                  value={form.tags}
                  onChange={handleChange}
                  placeholder="콤마(,)로 구분"
                />
              </label>
            </div>

            <button
              className="mt-6 w-full rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white"
              type="submit"
            >
              임시 등록
            </button>
          </form>

          <div className="flex flex-col gap-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                등록된 제휴 ({items.length})
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                이 화면의 등록은 새로고침 시 초기화됩니다.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {items.map((partner) => (
                <div
                  key={partner.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {partner.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {categoryMap.get(partner.category)} · {partner.location}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                      {partner.period.start} ~ {partner.period.end}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {partner.benefits.map((benefit) => (
                      <span
                        key={benefit}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
                      >
                        {benefit}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
