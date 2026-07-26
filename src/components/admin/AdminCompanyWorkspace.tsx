"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AdminTabs from "@/components/admin/AdminTabs";
import AdminSectionHeading from "@/components/admin/AdminSectionHeading";
import AdminCompanyManager from "@/components/admin/AdminCompanyManager";
import AdminPartnerAccountManager from "@/components/admin/AdminPartnerAccountManager";
import type { AdminPartnerAccount } from "@/components/admin/partner-account-manager/types";
import type { AdminCompanyFormActions } from "@/components/admin/admin-form-actions";
import {
  buildAdminCompanyTabHref,
  type AdminCompanyAccountSummary,
  type AdminCompanyTab,
} from "@/lib/admin-company-workspace";

export type AdminCompanyWorkspaceProps = {
  companies: Array<{
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    is_active?: boolean | null;
    created_at?: string | null;
    updated_at?: string | null;
    brandCount: number;
    accountCount: number;
  }>;
  accounts: AdminPartnerAccount[];
  accountSummary: AdminCompanyAccountSummary;
  generatedSetupUrl?: string | null;
  generatedSetupAccountId?: string | null;
  initialTab?: AdminCompanyTab;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
  actions: AdminCompanyFormActions;
};

const companyTabOptions = [
  {
    value: "companies",
    label: "파트너사",
    description: "회사 기본 정보와 연결 현황을 관리합니다.",
  },
  {
    value: "accounts",
    label: "파트너 계정",
    description: "담당자 계정과 초기 설정 링크를 관리합니다.",
  },
] as const;

export default function AdminCompanyWorkspace({
  companies,
  accounts,
  generatedSetupUrl,
  generatedSetupAccountId,
  initialTab = "companies",
  canCreate = false,
  canUpdate = false,
  canDelete = false,
  actions,
}: AdminCompanyWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<AdminCompanyTab>(initialTab);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleTabChange = (tab: AdminCompanyTab) => {
    setActiveTab(tab);
    router.replace(
      buildAdminCompanyTabHref(pathname, searchParams.toString(), tab),
      { scroll: false },
    );
  };

  return (
    <section className="grid gap-4">
      <AdminTabs<AdminCompanyTab>
        value={activeTab}
        onChange={handleTabChange}
        options={companyTabOptions}
      />

      {activeTab === "companies" ? (
        <section className="grid gap-4">
          <AdminSectionHeading
            eyebrow="데이터"
            title="파트너사 운영"
            description="회사 기본 정보, 연결 제휴처 수, 삭제/수정 작업을 한 영역에서 관리합니다."
          />
          <AdminCompanyManager
            companies={companies}
            canCreate={canCreate}
            canUpdate={canUpdate}
            canDelete={canDelete}
            actions={actions}
          />
        </section>
      ) : activeTab === "accounts" ? (
        <section className="grid gap-4">
          <AdminSectionHeading
            eyebrow="데이터"
            title="파트너 계정"
            description="담당 계정 생성, 초기 설정 링크 발급, 연결 조정을 같은 영역에서 처리합니다."
          />
          <AdminPartnerAccountManager
            accounts={accounts}
            companies={companies}
            generatedSetupUrl={generatedSetupUrl}
            generatedSetupAccountId={generatedSetupAccountId}
            canCreate={canCreate}
            canUpdate={canUpdate}
            actions={actions}
          />
        </section>
      ) : null}
    </section>
  );
}
