"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ADMIN_PARTNER_FILE_BENEFIT_ACTION_LABELS,
  ADMIN_PARTNER_FILE_SERVICE_MODE_LABELS,
  ADMIN_PARTNER_FILE_MAX_BYTES,
  type AdminPartnerFileBenefitActionType,
  type AdminPartnerFileDraft,
  type AdminPartnerFileParseResult,
} from "@/lib/admin-partner-file-import";
import type { PartnerServiceMode } from "@/lib/partner-service-mode";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import SectionHeading from "@/components/ui/SectionHeading";
import Select from "@/components/ui/Select";

const benefitActionOptions: Array<{
  value: AdminPartnerFileBenefitActionType;
  label: string;
}> = [
  { value: "external_link", label: "외부 링크로 이용" },
  { value: "certification", label: "싸트너십 인증으로 이용" },
  { value: "onsite", label: "현장 제시로 이용" },
  { value: "none", label: "별도 행동 없음" },
];

const guideItems = [
  "템플릿에는 한 제휴처만 입력합니다. 입력 시트의 입력값 열만 채워 주세요.",
  "카테고리는 드롭다운에서 선택하거나, 목록에 없으면 새 카테고리명을 직접 입력합니다.",
  "제휴처 전화번호는 파트너사 담당자 전화번호와 별도로 입력합니다.",
  "혜택, 이용 조건, 태그, 이미지 URL은 여러 개면 | 로 구분합니다.",
  "노출 캠퍼스와 적용 대상은 파일에서 받지 않고, 반영 후 단건 추가 폼에서 직접 지정합니다.",
  "검증이 끝나도 바로 저장되지 않습니다. 단건 추가 폼에서 확인 후 저장합니다.",
];

export default function AdminPartnerFileImportForm({
  onApplyDraft,
  parseFileAction,
}: {
  onApplyDraft: (draft: AdminPartnerFileDraft) => void;
  parseFileAction: (formData: FormData) => Promise<AdminPartnerFileParseResult>;
}) {
  const [serviceMode, setServiceMode] = useState<PartnerServiceMode>("offline");
  const [benefitActionType, setBenefitActionType] =
    useState<AdminPartnerFileBenefitActionType>("external_link");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const templateHref = useMemo(() => {
    const params = new URLSearchParams({
      serviceMode,
      benefitActionType,
    });
    return `/admin/partners/new/template?${params.toString()}`;
  }, [benefitActionType, serviceMode]);

  const handleApplyFile = () => {
    if (!file) {
      setErrors(["XLSX 파일을 선택해 주세요."]);
      return;
    }
    if (file.size > ADMIN_PARTNER_FILE_MAX_BYTES) {
      setErrors(["XLSX 파일은 1MB 이하만 업로드할 수 있습니다."]);
      return;
    }

    setErrors([]);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("file", file);
      const result = await parseFileAction(formData);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      onApplyDraft(result.draft);
    });
  };

  return (
    <div className="grid gap-6">
      <Card tone="muted" padding="md">
        <SectionHeading
          title="템플릿 기준 선택"
          description="선택한 기준에 따라 담당자가 입력할 XLSX 컬럼과 드롭다운을 구성합니다."
        />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            서비스 형태
            <Select
              value={serviceMode}
              onChange={(event) =>
                setServiceMode(event.target.value as PartnerServiceMode)
              }
            >
              <option value="offline">오프라인 제휴처</option>
              <option value="online">온라인 제휴처</option>
            </Select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            혜택 이용 방식
            <Select
              value={benefitActionType}
              onChange={(event) =>
                setBenefitActionType(
                  event.target.value as AdminPartnerFileBenefitActionType,
                )
              }
            >
              {benefitActionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <div className="mt-5 grid gap-3 rounded-[1rem] border border-border bg-surface-elevated p-4 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">현재 템플릿 기준</p>
          <p>
            {ADMIN_PARTNER_FILE_SERVICE_MODE_LABELS[serviceMode]} ·{" "}
            {ADMIN_PARTNER_FILE_BENEFIT_ACTION_LABELS[benefitActionType]}
          </p>
          <ul className="grid gap-1">
            {guideItems.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href={templateHref}
            download
            className="inline-flex h-11 items-center justify-center rounded-[1rem] border border-border bg-surface-control px-[1.125rem] text-sm font-semibold text-foreground shadow-flat transition-interactive hover:-translate-y-px hover:border-strong hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          >
            XLSX 템플릿 다운로드
          </a>
        </div>
      </Card>

      <Card padding="md">
        <SectionHeading
          title="파일 값 반영"
          description="XLSX를 서버에서 검증한 뒤 기존 단건 입력 폼에 값을 채웁니다."
        />
        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            XLSX 파일
            <Input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="h-auto py-3"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setErrors([]);
              }}
            />
          </label>

          {errors.length > 0 ? (
            <div className="rounded-[1rem] border border-danger/20 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
              {errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleApplyFile}
              loading={isPending}
              loadingText="검증 중"
            >
              XLSX 검증 후 폼에 반영
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
