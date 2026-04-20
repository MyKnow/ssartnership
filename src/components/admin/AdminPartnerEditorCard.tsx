"use client";

import { useMemo, useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import PartnerAudienceChips from "@/components/PartnerAudienceChips";
import PartnerCardForm from "@/components/PartnerCardForm";
import Badge from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import {
  getPartnerVisibilityBadgeClass,
  getPartnerVisibilityLabel,
  getPartnerVisibilityState,
} from "@/lib/partner-visibility";

type CategoryOption = {
  id: string;
  key: string;
  label: string;
  description?: string;
};

type PartnerValue = {
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
        is_active?: boolean | null;
      }
    | null;
};

export default function AdminPartnerEditorCard({
  partner,
  categoryOptions,
  companyOptions,
  formAction,
  deleteAction,
}: {
  partner: PartnerValue;
  categoryOptions: CategoryOption[];
  companyOptions: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  formAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  const category = useMemo(
    () =>
      categoryOptions.find((item) => item.id === partner.category_id) ?? null,
    [categoryOptions, partner.category_id],
  );
  const visibilityState = getPartnerVisibilityState(
    partner.visibility,
    partner.period_start,
    partner.period_end,
  );
  const company = partner.company ?? null;
  const thumbnail = partner.thumbnail ?? partner.images?.[0] ?? null;
  const galleryImages = partner.thumbnail
    ? partner.images ?? []
    : (partner.images ?? []).slice(1);

  return (
    <article className="rounded-[var(--radius-panel)] border border-border/80 bg-surface-elevated/95 p-4 shadow-[var(--shadow-flat)] backdrop-blur-md">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-4 rounded-[1.1rem] text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-base font-semibold text-foreground">{partner.name}</p>
          <div className="mt-2 flex items-center gap-2">
            <Badge className={getPartnerVisibilityBadgeClass(visibilityState)}>
              {getPartnerVisibilityLabel(visibilityState)}
            </Badge>
            <Badge className="bg-surface text-foreground">
              {category?.label ?? "미분류"}
            </Badge>
            <Badge className="bg-surface text-foreground">
              {company?.name ?? "회사 미연결"}
            </Badge>
          </div>
          <PartnerAudienceChips
            appliesTo={partner.applies_to ?? []}
            className="mt-2"
          />
        </div>
        <div className="inline-flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
          <span>{open ? "접기" : "펼치기"}</span>
          <ChevronDownIcon
            className={cn("h-5 w-5 transition-transform", open ? "rotate-180" : null)}
          />
        </div>
      </button>

      {open ? (
        <div className="mt-4 border-t border-border pt-4">
          <PartnerCardForm
            mode="edit"
            partner={{
              id: partner.id,
              name: partner.name ?? "",
              visibility: partner.visibility,
              location: partner.location ?? "",
              mapUrl: partner.map_url ?? "",
              reservationLink: partner.reservation_link ?? "",
              inquiryLink: partner.inquiry_link ?? "",
              period: {
                start: partner.period_start ?? "",
                end: partner.period_end ?? "",
              },
              conditions: partner.conditions ?? [],
              benefits: partner.benefits ?? [],
              appliesTo: partner.applies_to ?? [],
              thumbnail,
              images: galleryImages,
              tags: partner.tags ?? [],
              company: company
                ? {
                    id: company.id,
                    name: company.name,
                    description: company.description ?? "",
                    contactName: "",
                    contactEmail: "",
                    contactPhone: "",
                  }
                : null,
            }}
            categoryOptions={categoryOptions}
            companyOptions={companyOptions}
            categoryId={partner.category_id}
            formAction={formAction}
            deleteAction={deleteAction}
            submitLabel="수정"
            className="bg-surface"
          />
        </div>
      ) : null}
    </article>
  );
}
