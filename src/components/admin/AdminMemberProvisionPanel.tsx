"use client";

import { useState } from "react";
import AdminTabs from "@/components/admin/AdminTabs";
import AdminMemberDirectCreatePanel from "@/components/admin/AdminMemberDirectCreatePanel";
import AdminMemberManualAddPanel from "@/components/admin/AdminMemberManualAddPanel";
import type { DirectMemberCreateFormState } from "@/lib/member-direct-create";
import type { ManualMemberAddFormState } from "@/lib/member-manual-add";

type ProvisionMode = "verify" | "direct";

const PROVISION_MODE_OPTIONS = [
  {
    value: "verify",
    label: "SSAFY Verify 연동",
    description: "MM ID로 조회·추가",
  },
  {
    value: "direct",
    label: "직접 계정 생성",
    description: "외부 인증 없이 생성",
  },
] satisfies Array<{
  value: ProvisionMode;
  label: string;
  description: string;
}>;

export default function AdminMemberProvisionPanel({
  manualAddAction,
  directCreateAction,
}: {
  manualAddAction: (
    prevState: ManualMemberAddFormState,
    formData: FormData,
  ) => Promise<ManualMemberAddFormState>;
  directCreateAction: (
    prevState: DirectMemberCreateFormState,
    formData: FormData,
  ) => Promise<DirectMemberCreateFormState>;
}) {
  const [mode, setMode] = useState<ProvisionMode>("verify");

  return (
    <div className="grid gap-4">
      <AdminTabs
        value={mode}
        onChange={setMode}
        options={PROVISION_MODE_OPTIONS}
      />
      {mode === "verify" ? (
        <AdminMemberManualAddPanel action={manualAddAction} />
      ) : (
        <AdminMemberDirectCreatePanel action={directCreateAction} />
      )}
    </div>
  );
}
