"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  Landmark,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import SectionHeading from "@/components/ui/SectionHeading";
import SubmitButton from "@/components/ui/SubmitButton";
import PartnerFormPendingNotice from "@/components/partner/PartnerFormPendingNotice";
import PartnerPasswordChangeForm from "@/components/partner/PartnerPasswordChangeForm";
import type { PartnerBillingProfileRecord } from "@/lib/partner-billing-profiles";
import { cn } from "@/lib/cn";
import { getPartnerGlobalPortalHref } from "@/lib/partner-portal-paths";

type BusinessStatusState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "success";
      message: string;
      tone: "success" | "warning" | "neutral";
      checkedAt: string;
    }
  | { status: "error"; message: string; checkedAt: string };

export type PartnerAccountFormAction = (
  formData: FormData,
) => void | Promise<void>;

export type PartnerAccountInfoActions = {
  createProfile: PartnerAccountFormAction;
  setDefaultProfile: PartnerAccountFormAction;
  archiveProfile: PartnerAccountFormAction;
};

export type PartnerAccountInfoViewProps = {
  companyId: string;
  displayName: string;
  loginId: string;
  profiles: PartnerBillingProfileRecord[];
  actions: PartnerAccountInfoActions;
};

function formatBusinessRegistrationNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 10) {
    return value;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

function getProfileDescription(profile: PartnerBillingProfileRecord) {
  return [
    profile.businessName,
    profile.representativeName,
    formatBusinessRegistrationNumber(profile.businessRegistrationNumber),
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatBusinessStatusCheckedAt(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getBusinessStatusTone(
  businessStatusCode: string | undefined,
): "success" | "warning" | "neutral" {
  if (businessStatusCode === "01") {
    return "success";
  }
  if (businessStatusCode === "02" || businessStatusCode === "03") {
    return "warning";
  }
  return "neutral";
}

function BusinessStatusMessage({ state }: { state: BusinessStatusState }) {
  if (state.status === "idle" || state.status === "loading") {
    return null;
  }

  return (
    <div
      className={cn(
        "grid gap-0.5 text-xs font-medium leading-5",
        state.status === "error"
          ? "text-danger"
          : state.tone === "success"
            ? "text-success"
            : state.tone === "warning"
              ? "text-warning"
              : "text-muted-foreground",
      )}
      role="status"
      aria-live="polite"
    >
      <p>{state.message}</p>
      <p className="text-muted-foreground">마지막 확인 {state.checkedAt}</p>
    </div>
  );
}

function BillingProfileCreateForm({
  companyId,
  action,
}: {
  companyId: string;
  action: PartnerAccountFormAction;
}) {
  const [businessRegistrationNumber, setBusinessRegistrationNumber] =
    useState("");
  const [businessStatus, setBusinessStatus] = useState<BusinessStatusState>({
    status: "idle",
  });
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const canLookup = businessRegistrationNumber.replace(/\D/g, "").length >= 10;

  async function lookupBusinessStatus() {
    setBusinessStatus({ status: "loading" });
    const response = await fetch("/api/partner/billing/business-status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        companyId,
        businessRegistrationNumber,
      }),
    }).catch(() => null);

    if (!mountedRef.current) {
      return;
    }

    if (!response) {
      setBusinessStatus({
        status: "error",
        message: "사업자 상태를 확인하지 못했습니다.",
        checkedAt: formatBusinessStatusCheckedAt(new Date()),
      });
      return;
    }

    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      message?: string;
      businessStatus?: string;
      businessStatusCode?: string;
      taxType?: string;
    };

    if (!mountedRef.current) {
      return;
    }

    if (!response.ok || payload.ok === false) {
      setBusinessStatus({
        status: "error",
        message: payload.message ?? "사업자 상태를 확인하지 못했습니다.",
        checkedAt: formatBusinessStatusCheckedAt(new Date()),
      });
      return;
    }

    const businessStatusLabel = payload.businessStatus || "상태 정보 없음";
    const taxTypeLabel = payload.taxType || "과세 유형 정보 없음";
    const statusCodeLabel = payload.businessStatusCode
      ? `국세청 코드 ${payload.businessStatusCode}`
      : "국세청 코드 없음";
    setBusinessStatus({
      status: "success",
      tone: getBusinessStatusTone(payload.businessStatusCode),
      message: `${businessStatusLabel} · ${taxTypeLabel} · ${statusCodeLabel}`,
      checkedAt: formatBusinessStatusCheckedAt(new Date()),
    });
  }

  return (
    <Card tone="default" padding="md" className="grid gap-5">
      <SectionHeading
        title="새 프로필 추가"
        description="플랜 요청에서 전체 파트너사에 재사용할 입금자와 세금계산서 정보를 저장합니다."
      />
      <form action={action} className="grid gap-4">
        <input type="hidden" name="companyId" value={companyId} />

        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-foreground">
            프로필 이름
            <Input
              name="label"
              maxLength={80}
              placeholder="예: 본점 세금계산서"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            입금자명
            <Input name="payerName" maxLength={80} required />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className="grid gap-2 text-sm font-medium text-foreground">
            사업자등록번호
            <Input
              name="businessRegistrationNumber"
              inputMode="numeric"
              placeholder="000-00-00000"
              maxLength={12}
              required
              value={businessRegistrationNumber}
              onChange={(event) => {
                setBusinessRegistrationNumber(event.target.value);
                setBusinessStatus({ status: "idle" });
              }}
            />
          </label>
          <Button
            type="button"
            variant="secondary"
            disabled={!canLookup || businessStatus.status === "loading"}
            loading={businessStatus.status === "loading"}
            loadingText="확인 중"
            onClick={lookupBusinessStatus}
            className="w-full md:w-auto"
          >
            <Search className="h-4 w-4" />
            상태 확인
          </Button>
        </div>
        <BusinessStatusMessage state={businessStatus} />
        <p className="text-xs leading-5 text-muted-foreground">
          국세청 사업자등록 상태조회는 휴폐업 상태와 과세 유형만 확인합니다.
          상호, 대표자, 주소는 직접 입력해 주세요.
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-foreground">
            상호
            <Input name="businessName" maxLength={120} required />
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            대표자명
            <Input name="representativeName" maxLength={80} required />
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground md:col-span-2">
            사업장 주소
            <Input name="businessAddress" maxLength={300} required />
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            업태
            <Input name="businessType" maxLength={80} required />
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            종목
            <Input name="businessItem" maxLength={120} required />
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground md:col-span-2">
            세금계산서 이메일
            <Input
              name="taxInvoiceEmail"
              type="email"
              maxLength={254}
              required
            />
          </label>
        </div>

        <label className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <input
            type="checkbox"
            name="isDefault"
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
          />
          기본 프로필로 사용
        </label>

        <div className="grid gap-2 sm:justify-items-end">
          <PartnerFormPendingNotice message="증빙 프로필을 저장하는 중입니다." />
          <SubmitButton pendingText="저장 중" className="w-full sm:w-auto">
            프로필 저장
          </SubmitButton>
        </div>
      </form>
    </Card>
  );
}

function BillingProfileCard({
  companyId,
  profile,
  setDefaultAction,
  archiveAction,
}: {
  companyId: string;
  profile: PartnerBillingProfileRecord;
  setDefaultAction: PartnerAccountFormAction;
  archiveAction: PartnerAccountFormAction;
}) {
  const isLegacyProfile = profile.accountId === null;
  return (
    <Card tone="muted" padding="md" className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-foreground">
              {profile.label}
            </h3>
            {profile.isDefault ? <Badge variant="primary">기본</Badge> : null}
            {isLegacyProfile ? (
              <Badge variant="neutral">기존 파트너사 정보</Badge>
            ) : (
              <Badge variant="success">전체 파트너사</Badge>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-ko-pretty text-sm leading-6 text-muted-foreground">
            {getProfileDescription(profile)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!profile.isDefault && !isLegacyProfile ? (
            <form action={setDefaultAction} className="grid gap-2">
              <input type="hidden" name="companyId" value={companyId} />
              <input type="hidden" name="profileId" value={profile.id} />
              <PartnerFormPendingNotice message="기본 프로필로 변경하는 중입니다." />
              <SubmitButton variant="secondary" pendingText="변경 중">
                <CheckCircle2 className="h-4 w-4" />
                기본값
              </SubmitButton>
            </form>
          ) : null}
          {!isLegacyProfile ? (
            <form action={archiveAction} className="grid gap-2">
              <input type="hidden" name="companyId" value={companyId} />
              <input type="hidden" name="profileId" value={profile.id} />
              <PartnerFormPendingNotice message="증빙 프로필을 삭제하는 중입니다." />
              <SubmitButton variant="danger" pendingText="삭제 중">
                <Trash2 className="h-4 w-4" />
                삭제
              </SubmitButton>
            </form>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 text-sm md:grid-cols-2">
        <div className="min-w-0 rounded-[0.9rem] border border-border bg-surface-control p-3">
          <p className="text-xs font-semibold text-muted-foreground">
            입금자명
          </p>
          <p className="mt-1 truncate font-semibold text-foreground">
            {profile.payerName}
          </p>
        </div>
        <div className="min-w-0 rounded-[0.9rem] border border-border bg-surface-control p-3">
          <p className="text-xs font-semibold text-muted-foreground">
            세금계산서 이메일
          </p>
          <p className="mt-1 text-token font-semibold text-foreground">
            {profile.taxInvoiceEmail}
          </p>
        </div>
        <div className="min-w-0 rounded-[0.9rem] border border-border bg-surface-control p-3 md:col-span-2">
          <p className="text-xs font-semibold text-muted-foreground">
            사업장 주소
          </p>
          <p className="mt-1 line-clamp-2 text-ko-pretty text-foreground">
            {profile.businessAddress}
          </p>
        </div>
        <div className="min-w-0 rounded-[0.9rem] border border-border bg-surface-control p-3">
          <p className="text-xs font-semibold text-muted-foreground">업태</p>
          <p className="mt-1 truncate text-foreground">
            {profile.businessType}
          </p>
        </div>
        <div className="min-w-0 rounded-[0.9rem] border border-border bg-surface-control p-3">
          <p className="text-xs font-semibold text-muted-foreground">종목</p>
          <p className="mt-1 truncate text-foreground">
            {profile.businessItem}
          </p>
        </div>
      </div>
    </Card>
  );
}

export default function PartnerAccountInfoView({
  companyId,
  displayName,
  loginId,
  profiles,
  actions,
}: PartnerAccountInfoViewProps) {
  const defaultProfile = useMemo(
    () => profiles.find((profile) => profile.isDefault) ?? profiles[0] ?? null,
    [profiles],
  );
  const successRedirectHref = `${getPartnerGlobalPortalHref("account", companyId)}#security`;

  return (
    <div className="grid gap-6">
      <Card tone="default" padding="md" className="grid gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="ui-kicker">프로필</p>
            <h2 className="mt-2 text-ko-title text-xl font-semibold leading-tight text-foreground">
              모든 파트너사에서 동일하게 쓰는 계정 프로필입니다.
            </h2>
            <p className="mt-2 text-ko-pretty text-sm leading-6 text-muted-foreground">
              로그인 정보, 비밀번호, 입금자와 세금계산서 정보를 한 곳에서
              관리합니다.
            </p>
          </div>
          {defaultProfile ? (
            <div className="min-w-0 rounded-[1rem] border border-primary/15 bg-primary-soft p-4 text-sm">
              <div className="flex items-center gap-2 font-semibold text-primary">
                <Landmark className="h-4 w-4" />
                기본 증빙 프로필
              </div>
              <p className="mt-2 truncate text-foreground">
                {defaultProfile.label}
              </p>
              <p className="mt-1 text-token text-xs text-muted-foreground">
                {defaultProfile.payerName} · {defaultProfile.taxInvoiceEmail}
              </p>
            </div>
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="min-w-0 rounded-[0.9rem] border border-border bg-surface-control p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <UserRound className="h-4 w-4 text-primary" />
              담당자
            </div>
            <p className="mt-2 truncate text-sm text-muted-foreground">
              {displayName}
            </p>
          </div>
          <div className="min-w-0 rounded-[0.9rem] border border-border bg-surface-control p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <KeyRound className="h-4 w-4 text-primary" />
              로그인 ID
            </div>
            <p className="mt-2 text-token text-sm text-muted-foreground">
              {loginId}
            </p>
          </div>
        </div>
      </Card>

      <section className="grid gap-4">
        <SectionHeading
          title="저장된 증빙 프로필"
          description="입금자와 세금계산서 정보를 여러 개 저장해 모든 파트너사의 플랜 요청에서 재사용합니다."
        />
        {profiles.length === 0 ? (
          <Card tone="muted" padding="md">
            <EmptyState
              title="저장된 증빙 프로필이 없습니다."
              description="먼저 세금계산서 발급 정보를 저장한 뒤 플랜 업그레이드를 요청해 주세요."
            />
          </Card>
        ) : (
          <div className="grid gap-3">
            {profiles.map((profile) => (
              <BillingProfileCard
                key={profile.id}
                companyId={companyId}
                profile={profile}
                setDefaultAction={actions.setDefaultProfile}
                archiveAction={actions.archiveProfile}
              />
            ))}
          </div>
        )}
      </section>

      <BillingProfileCreateForm
        companyId={companyId}
        action={actions.createProfile}
      />

      <section id="security" className="grid gap-4 scroll-mt-24">
        <SectionHeading
          title="비밀번호 변경"
          description="현재 비밀번호를 확인한 뒤 새 비밀번호로 계정 보안을 업데이트합니다."
        />
        <PartnerPasswordChangeForm
          mustChangePassword={false}
          successRedirectHref={successRedirectHref}
        />
      </section>
    </div>
  );
}
