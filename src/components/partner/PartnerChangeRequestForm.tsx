"use client";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import SectionHeading from "@/components/ui/SectionHeading";
import SubmitButton from "@/components/ui/SubmitButton";
import TokenChipField from "@/components/admin/TokenChipField";
import {
  PartnerGalleryField,
  PartnerThumbnailField,
} from "@/components/admin/PartnerMediaEditor";
import { PARTNER_AUDIENCE_OPTIONS } from "@/lib/partner-audience";
import type {
  PartnerChangeRequestContext,
  PartnerChangeRequestSummary,
} from "@/lib/partner-change-requests";
import { cn } from "@/lib/cn";

type PartnerChangeRequestFormProps = {
  context: PartnerChangeRequestContext;
  pendingRequest: PartnerChangeRequestSummary | null;
  canCancelPendingRequest: boolean;
  errorMessage?: string | null;
  successMessage?: string | null;
  createAction: (formData: FormData) => void | Promise<void>;
  cancelAction: (formData: FormData) => void | Promise<void>;
};

function FieldGroup({
  label,
  children,
  note,
}: {
  label: string;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
    </label>
  );
}

export default function PartnerChangeRequestForm({
  context,
  pendingRequest,
  canCancelPendingRequest,
  errorMessage,
  successMessage,
  createAction,
  cancelAction,
}: PartnerChangeRequestFormProps) {
  return (
    <div className="space-y-6">
      {errorMessage ? <FormMessage variant="error">{errorMessage}</FormMessage> : null}
      {successMessage ? <FormMessage>{successMessage}</FormMessage> : null}

      {pendingRequest ? (
        <div className="space-y-4 rounded-3xl border border-amber-500/20 bg-amber-500/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <Badge className="bg-amber-500/10 text-amber-700">
                승인 대기 중
              </Badge>
              <p className="text-sm leading-6 text-muted-foreground">
                제출된 변경 요청은 관리자 승인 전까지 반영되지 않습니다.
              </p>
            </div>
            <div className="text-xs text-muted-foreground">
              요청 시각 {new Date(pendingRequest.createdAt).toLocaleString("ko-KR")}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              요청자:{" "}
              <span className="font-medium text-foreground">
                {pendingRequest.requestedByDisplayName ??
                  pendingRequest.requestedByLoginId ??
                  "미지정"}
              </span>
            </div>

            {canCancelPendingRequest ? (
              <form action={cancelAction}>
                <input type="hidden" name="requestId" value={pendingRequest.id} />
                <input type="hidden" name="partnerId" value={pendingRequest.partnerId} />
                <SubmitButton variant="danger" pendingText="취소 중">
                  요청 취소
                </SubmitButton>
              </form>
            ) : (
              <Badge className="bg-surface text-muted-foreground">
                요청 취소는 요청자만 가능합니다.
              </Badge>
            )}
          </div>
        </div>
      ) : (
        <form action={createAction} className="space-y-6">
          <input type="hidden" name="partnerId" value={context.partnerId} />

          <Card className="overflow-hidden">
            <SectionHeading
              title="이미지 / 링크 / 기간"
              description="썸네일, 기타 이미지, 예약/문의 링크, 브랜드 제휴 기간은 관리자 승인 후 반영됩니다."
            />

            <div className="mt-6 grid gap-6">
              <div className="grid gap-6 xl:grid-cols-2">
                <PartnerThumbnailField
                  initial={context.thumbnail}
                  className="w-full"
                />
                <PartnerGalleryField
                  initial={context.images}
                  className="w-full"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FieldGroup
                  label="예약 링크"
                  note="http(s), 전화번호, 이메일, 인스타그램 아이디를 입력할 수 있습니다."
                >
                  <Input
                    name="reservationLink"
                    defaultValue={context.reservationLink ?? ""}
                    placeholder="예약 링크 또는 연락처"
                  />
                </FieldGroup>
                <FieldGroup
                  label="문의 링크"
                  note="예약 링크와 같은 형식으로 입력할 수 있습니다."
                >
                  <Input
                    name="inquiryLink"
                    defaultValue={context.inquiryLink ?? ""}
                    placeholder="문의 링크 또는 연락처"
                  />
                </FieldGroup>
                <FieldGroup
                  label="브랜드 시작일"
                  note="기간 변경은 관리자 승인이 필요합니다."
                >
                  <Input
                    type="date"
                    name="periodStart"
                    defaultValue={context.periodStart ?? ""}
                  />
                </FieldGroup>
                <FieldGroup
                  label="브랜드 종료일"
                  note="기간 변경은 관리자 승인이 필요합니다."
                >
                  <Input
                    type="date"
                    name="periodEnd"
                    defaultValue={context.periodEnd ?? ""}
                  />
                </FieldGroup>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <TokenChipField
              name="conditions"
              initialValues={context.currentConditions}
              placeholder="줄바꿈으로 조건을 추가하세요."
              helpText="조건은 줄바꿈으로 구분합니다."
              emptyText="조건을 입력해 주세요."
            />
            <TokenChipField
              name="benefits"
              initialValues={context.currentBenefits}
              placeholder="줄바꿈으로 혜택을 추가하세요."
              helpText="혜택은 줄바꿈으로 구분합니다."
              emptyText="혜택을 입력해 주세요."
            />
            <TokenChipField
              name="tags"
              initialValues={context.tags}
              placeholder="줄바꿈으로 태그를 추가하세요."
              helpText="태그는 줄바꿈으로 구분합니다."
              emptyText="태그를 입력해 주세요."
            />
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">적용 대상</p>
              <p className="text-xs text-muted-foreground">
                하나 이상 선택해 주세요.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {PARTNER_AUDIENCE_OPTIONS.map((option) => {
                const id = `partner-change-request-audience-${option.value}`;
                const defaultChecked = context.currentAppliesTo.includes(
                  option.value,
                );

                return (
                  <label
                    key={option.value}
                    htmlFor={id}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3",
                      defaultChecked
                        ? "border-primary/30 bg-primary/5"
                        : null,
                    )}
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {option.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        포털 노출 대상을 선택합니다.
                      </p>
                    </div>
                    <input
                      id={id}
                      type="checkbox"
                      name="appliesTo"
                      value={option.value}
                      defaultChecked={defaultChecked}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                  </label>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background/70 p-4">
            <p className="text-sm font-semibold text-foreground">안내</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              혜택, 이용 조건, 태그, 적용 대상, 썸네일, 기타 이미지, 예약/문의
              링크, 브랜드 제휴 기간은 관리자 승인 후 반영됩니다. 승인 전에는 현재 값이
              그대로 유지됩니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton pendingText="요청 중" className="w-full sm:w-auto">
              변경 요청
            </SubmitButton>
            <Button href="/partner" variant="ghost" className="w-full sm:w-auto">
              포털로 돌아가기
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
