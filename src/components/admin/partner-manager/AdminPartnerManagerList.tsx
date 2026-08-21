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
  categories,
}: {
  partners: AdminPartner[];
  categories: AdminCategory[];
}) {
  if (partners.length === 0) {
    return (
      <EmptyState
        title={ADMIN_COPY.emptyPartnerTitle}
        description={ADMIN_COPY.emptyPartnerDescription}
      />
    );
  }

  return (
    <div className="grid gap-6">
      {partners.map((partner) => (
        <AdminPartnerListItem
          key={partner.id}
          partner={partner}
          category={categories.find((category) => category.id === partner.category_id) ?? null}
        />
      ))}
    </div>
  );
}
