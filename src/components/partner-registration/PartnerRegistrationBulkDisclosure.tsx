"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import SubmitButton from "@/components/ui/SubmitButton";
import { cn } from "@/lib/cn";
import type { AdminPartnerFileBenefitActionType } from "@/lib/admin-partner-file-import";
import {
  getPartnerRegistrationTemplateHref,
  PARTNER_REGISTRATION_BENEFIT_ACTION_OPTIONS,
  PARTNER_REGISTRATION_INITIAL_EXCEL_ACTION_STATE,
  PARTNER_REGISTRATION_SERVICE_OPTIONS,
  type PartnerRegistrationExcelActionState,
} from "@/lib/partner-registration";
import type { PartnerServiceMode } from "@/lib/partner-service-mode";
import { PartnerRegistrationTypeSelector } from "./PartnerRegistrationSelectors";

export type PartnerRegistrationExcelAction = (
  previousState: PartnerRegistrationExcelActionState,
  formData: FormData,
) => Promise<PartnerRegistrationExcelActionState>;

const invalidFieldClassName =
  "border-danger/50 bg-danger/5 focus:border-danger focus:ring-danger/15";

export default function PartnerRegistrationBulkDisclosure({
  action,
  serviceMode,
  benefitActionType,
  onServiceModeChange,
  onBenefitActionTypeChange,
}: {
  action: PartnerRegistrationExcelAction;
  serviceMode: PartnerServiceMode;
  benefitActionType: AdminPartnerFileBenefitActionType;
  onServiceModeChange: (value: PartnerServiceMode) => void;
  onBenefitActionTypeChange: (value: AdminPartnerFileBenefitActionType) => void;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    action,
    PARTNER_REGISTRATION_INITIAL_EXCEL_ACTION_STATE,
  );
  const [clientFileError, setClientFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const error = clientFileError ?? state.fileError;
  const templateHref = useMemo(
    () => getPartnerRegistrationTemplateHref({ serviceMode, benefitActionType }),
    [benefitActionType, serviceMode],
  );
  const selectedService = PARTNER_REGISTRATION_SERVICE_OPTIONS.find(
    (option) => option.value === serviceMode,
  );
  const selectedAction = PARTNER_REGISTRATION_BENEFIT_ACTION_OPTIONS.find(
    (option) => option.value === benefitActionType,
  );

  useEffect(() => {
    if (!error || !fileInputRef.current) {
      return;
    }
    fileInputRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    window.requestAnimationFrame(() => fileInputRef.current?.focus({ preventScroll: true }));
  }, [error]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const file = fileInputRef.current?.files?.[0] ?? null;
    if (file) {
      setClientFileError(null);
      return;
    }
    event.preventDefault();
    setClientFileError("XLSX 파일을 업로드해 주세요.");
  }

  return (
    <Card tone="muted" padding="md" className="grid min-w-0 gap-4">
      <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="min-w-0">
          <p className="ui-kicker">Bulk File</p>
          <h2 className="mt-1 truncate text-base font-semibold text-foreground">
            파일로 일괄 접수
          </h2>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
            정리된 자료가 있으면 XLSX 양식으로 여러 제휴처를 한 번에 접수할 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="partner-registration-bulk-panel"
          onClick={() => setOpen((current) => !current)}
          className={cn(
            "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[1rem] border px-[1.125rem] text-sm font-semibold shadow-flat transition-interactive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 md:w-auto",
            open
              ? "border-border/70 bg-surface-muted text-foreground"
              : "border-primary/10 bg-primary-soft text-primary",
          )}
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
          파일 접수 {open ? "닫기" : "열기"}
        </button>
      </div>

      {open ? (
        <div
          id="partner-registration-bulk-panel"
          className="grid min-w-0 gap-5 border-t border-border/70 pt-4"
        >
          <PartnerRegistrationTypeSelector
            serviceMode={serviceMode}
            benefitActionType={benefitActionType}
            onServiceModeChange={onServiceModeChange}
            onBenefitActionTypeChange={onBenefitActionTypeChange}
          />

          <div className="grid min-w-0 gap-3 rounded-[1rem] border border-border/70 bg-surface px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {selectedService?.label} · {selectedAction?.label}
              </p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                제휴처 공통 정보 양식입니다. 다지점 목록도 XLSX로 추가할 수 있습니다.
              </p>
            </div>
            <Button
              href={templateHref}
              variant="primary"
              className="w-full md:w-auto"
              prefetch={false}
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              XLSX 다운로드
            </Button>
          </div>

          {state.message ? (
            <FormMessage
              variant={state.status === "success" ? "info" : "error"}
              className="break-words"
            >
              {state.message}
            </FormMessage>
          ) : null}

          <form action={formAction} noValidate className="grid min-w-0 gap-4" onSubmit={handleSubmit}>
            <input type="hidden" name="serviceMode" value={serviceMode} />
            <input type="hidden" name="benefitActionType" value={benefitActionType} />
            <label className="grid min-w-0 gap-2" htmlFor="partner-registration-xlsxFile">
              <span className="ui-caption inline-flex min-w-0 items-center gap-1">
                <span className="truncate">파일 업로드</span>
                <span className="shrink-0 text-danger" aria-label="필수 입력">*</span>
              </span>
              <Input
                id="partner-registration-xlsxFile"
                ref={fileInputRef}
                name="xlsxFile"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                aria-invalid={Boolean(error) || undefined}
                className={cn(error ? invalidFieldClassName : undefined, "max-w-full")}
                onChange={() => setClientFileError(null)}
              />
              <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                다운로드한 싸트너십 양식을 작성해 .xlsx 파일로 업로드해 주세요.
              </span>
              {error ? (
                <span className="text-xs font-medium leading-5 text-danger" role="alert">
                  {error}
                </span>
              ) : null}
            </label>
            <div className="flex justify-end border-t border-border/70 pt-4">
              <SubmitButton pendingText="업로드 중" className="w-full sm:w-auto">
                업로드 및 신청 접수
              </SubmitButton>
            </div>
          </form>
        </div>
      ) : null}
    </Card>
  );
}
