"use client";

import { useEffect, useState } from "react";
import Tabs from "@/components/ui/Tabs";
import SectionHeading from "@/components/ui/SectionHeading";
import AdminCompanyManager from "@/components/admin/AdminCompanyManager";
import AdminPartnerAccountManager from "@/components/admin/AdminPartnerAccountManager";
import type { AdminPartnerAccount } from "@/components/admin/partner-account-manager/types";

type AdminCompanyWorkspaceProps = {
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
  generatedSetupUrl?: string | null;
  generatedSetupAccountId?: string | null;
  initialTab?: AdminCompanyTab;
};

type AdminCompanyTab = "companies" | "accounts";

const companyTabOptions = [
  {
    value: "companies",
    label: "협력사",
    description: "협력사 기본 정보와 연결 현황을 관리합니다.",
  },
  {
    value: "accounts",
    label: "협력사 계정",
    description: "담당 계정 생성과 초기 설정 링크를 관리합니다.",
  },
] as const;

export default function AdminCompanyWorkspace({
  companies,
  accounts,
  generatedSetupUrl,
  generatedSetupAccountId,
  initialTab = "companies",
}: AdminCompanyWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<AdminCompanyTab>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <section className="grid gap-4">
      <Tabs value={activeTab} onChange={setActiveTab} options={companyTabOptions} />

      {activeTab === "companies" ? (
        <section className="grid gap-4">
          <SectionHeading
            eyebrow="Companies"
            title="협력사 운영"
            description="협력사 기본 정보, 연결 브랜드 수, 삭제/수정 작업을 한 영역에서 관리합니다."
          />
          <AdminCompanyManager companies={companies} accounts={accounts} />
        </section>
      ) : (
        <section className="grid gap-4">
          <SectionHeading
            eyebrow="Accounts"
            title="협력사 계정"
            description="담당 계정 생성, 초기 설정 링크 발급, 연결 조정을 같은 영역에서 처리합니다."
          />
          <AdminPartnerAccountManager
            accounts={accounts}
            companies={companies}
            generatedSetupUrl={generatedSetupUrl}
            generatedSetupAccountId={generatedSetupAccountId}
          />
        </section>
      )}
    </section>
  );
}
