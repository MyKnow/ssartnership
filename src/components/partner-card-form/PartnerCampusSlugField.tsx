"use client";

import { useMemo, useState } from "react";
import {
  CAMPUS_DIRECTORY,
  CAMPUS_SLUGS,
  inferCampusSlugsFromLocation,
  normalizeCampusSlugs,
  type CampusSlug,
} from "@/lib/campuses";
import FieldGroup from "@/components/partner-card-form/FieldGroup";

function getInitialCampusSlugs(
  defaultValue: CampusSlug[] | null | undefined,
  location: string | null | undefined,
) {
  const explicitSlugs = normalizeCampusSlugs(defaultValue ?? []);
  if (explicitSlugs.length > 0) {
    return explicitSlugs;
  }

  const inferredSlugs = inferCampusSlugsFromLocation(location ?? "");
  return inferredSlugs.length > 0 ? inferredSlugs : [...CAMPUS_SLUGS];
}

export default function PartnerCampusSlugField({
  defaultValue,
  location,
  error,
  name = "campusSlugs",
  label = "노출 캠퍼스",
  description = "위치 문구와 별개로 실제 노출할 캠퍼스를 명시합니다.",
  onSelectionChange,
}: {
  defaultValue?: CampusSlug[] | null;
  location?: string | null;
  error?: string;
  name?: string;
  label?: string;
  description?: string;
  onSelectionChange?: (value: CampusSlug[]) => void;
}) {
  const initialValue = useMemo(
    () => getInitialCampusSlugs(defaultValue, location),
    [defaultValue, location],
  );
  const [selectedSlugs, setSelectedSlugs] = useState<CampusSlug[]>(initialValue);
  const allSelected = selectedSlugs.length === CAMPUS_SLUGS.length;

  const updateSelectedSlugs = (nextValue: CampusSlug[]) => {
    setSelectedSlugs(nextValue);
    onSelectionChange?.(nextValue);
  };

  const toggleCampus = (slug: CampusSlug) => {
    updateSelectedSlugs(
      selectedSlugs.includes(slug)
        ? selectedSlugs.filter((item) => item !== slug)
        : [...selectedSlugs, slug],
    );
  };

  return (
    <FieldGroup label={label} error={error}>
      <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(event) =>
              updateSelectedSlugs(event.target.checked ? [...CAMPUS_SLUGS] : [])
            }
            className="mt-1 h-4 w-4 rounded border-slate-300 text-[#234577] focus:ring-[#234577]"
          />
          <span>
            전체 캠퍼스
            <span className="mt-1 block text-xs font-medium text-slate-500">
              모든 캠퍼스 페이지에 이 브랜드를 노출합니다.
            </span>
          </span>
        </label>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {CAMPUS_DIRECTORY.map((campus) => (
            <label
              key={campus.slug}
              className="flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
            >
              <input
                type="checkbox"
                name={name}
                value={campus.slug}
                checked={selectedSlugs.includes(campus.slug)}
                onChange={() => toggleCampus(campus.slug)}
                className="h-4 w-4 rounded border-slate-300 text-[#234577] focus:ring-[#234577]"
              />
              {campus.fullLabel}
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">{description}</p>
      </div>
    </FieldGroup>
  );
}
