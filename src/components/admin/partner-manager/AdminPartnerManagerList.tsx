"use client";

import EmptyState from "@/components/ui/EmptyState";
import AdminPartnerEditorCard from "@/components/admin/AdminPartnerEditorCard";
import { ADMIN_COPY } from "@/lib/content";
import type {
  AdminPartner,
} from "@/components/admin/partner-manager/types";

export default function AdminPartnerManagerList({
  partners,
  filteredPartners,
  categoryOptions,
  companyOptions,
  updatePartner,
  deletePartner,
}: {
  partners: AdminPartner[];
  filteredPartners: AdminPartner[];
  categoryOptions: Array<{
    id: string;
    label: string;
    key: string;
    description: string;
  }>;
  companyOptions: Array<{
    id: string;
    name: string;
    slug: string;
    contactName: string;
    contactEmail: string;
  }>;
  updatePartner: (formData: FormData) => void | Promise<void>;
  deletePartner: (formData: FormData) => void | Promise<void>;
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
        <AdminPartnerEditorCard
          key={partner.id}
          partner={partner}
          categoryOptions={categoryOptions}
          companyOptions={companyOptions}
          formAction={updatePartner}
          deleteAction={deletePartner}
        />
      ))}
    </div>
  );
}
