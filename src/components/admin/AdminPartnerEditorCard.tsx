"use client";

import { useMemo, useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import PartnerCard from "@/components/PartnerCard";
import Badge from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import {
  getPartnerVisibilityBadgeClass,
  getPartnerVisibilityLabel,
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

export default function AdminPartnerEditorCard({
  partner,
  categoryOptions,
  formAction,
  deleteAction,
}: {
  partner: PartnerValue;
  categoryOptions: CategoryOption[];
  formAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  const category = useMemo(
    () =>
      categoryOptions.find((item) => item.id === partner.category_id) ?? null,
    [categoryOptions, partner.category_id],
  );

  return (
    <article className="rounded-3xl border border-border bg-surface-elevated p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-4 rounded-2xl text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-base font-semibold text-foreground">{partner.name}</p>
          <div className="mt-2 flex items-center gap-2">
            <Badge className={getPartnerVisibilityBadgeClass(partner.visibility)}>
              {getPartnerVisibilityLabel(partner.visibility)}
            </Badge>
            <Badge className="bg-surface text-foreground">
              {category?.label ?? "미분류"}
            </Badge>
          </div>
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
          <PartnerCard
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
              benefits: partner.benefits ?? [],
              conditions: partner.conditions ?? [],
              images: partner.images ?? [],
              tags: partner.tags ?? [],
            }}
            categoryOptions={categoryOptions}
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
