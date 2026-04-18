"use client";

import EmptyState from "@/components/ui/EmptyState";
import AdminPartnerListItem from "@/components/admin/partner-manager/AdminPartnerListItem";
import { ADMIN_COPY } from "@/lib/content";
import type {
  AdminCategory,
  AdminPartner,
} from "@/components/admin/partner-manager/types";

export default function AdminPartnerManagerList({
  partners,
  filteredPartners,
  categories,
}: {
  partners: AdminPartner[];
  filteredPartners: AdminPartner[];
  categories: AdminCategory[];
}) {
  if (filteredPartners.length === 0) {
    return (
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
    );
  }

  return (
    <div className="grid gap-6">
      {filteredPartners.map((partner) => (
        <AdminPartnerListItem
          key={partner.id}
          partner={partner}
          category={categories.find((category) => category.id === partner.category_id) ?? null}
        />
      ))}
    </div>
  );
}
