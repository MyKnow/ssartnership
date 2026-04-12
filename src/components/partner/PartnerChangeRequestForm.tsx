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

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="space-y-4 p-5">
      <SectionHeading title={title} description={description} />
      <div>{children}</div>
    </Card>
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

          <div className="grid gap-4">
            <SectionCard
              title="브랜드 정보"
              description="브랜드명, 위치, 지도 URL을 수정합니다."
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <FieldGroup
                  label="브랜드명"
                  note="브랜드명 변경도 관리자 승인 후 반영됩니다."
                >
                  <Input
                    name="partnerName"
                    defaultValue={context.partnerName}
                    placeholder="브랜드명"
                  />
                </FieldGroup>
                <FieldGroup
                  label="위치"
                  note="지도 버튼과 상세 위치 표시에 사용됩니다."
                >
                  <Input
                    name="partnerLocation"
                    defaultValue={context.partnerLocation}
                    placeholder="예: 서울 강남구 역삼로 123"
                  />
                </FieldGroup>
                <FieldGroup
                  label="지도 URL"
                  note="비워두면 지도 버튼이 숨겨집니다."
                >
                  <Input
                    name="mapUrl"
                    defaultValue={context.mapUrl ?? ""}
                    placeholder="https://map.naver.com/..."
                  />
                </FieldGroup>
              </div>
            </SectionCard>

            <SectionCard
              title="이미지"
              description="썸네일과 기타 이미지를 수정합니다."
            >
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
            </SectionCard>

            <SectionCard
              title="링크"
              description="예약 링크와 문의 링크를 수정합니다."
            >
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
              </div>
            </SectionCard>

            <SectionCard
              title="기간"
              description="브랜드 노출 시작일과 종료일을 수정합니다."
            >
              <div className="grid gap-4 sm:grid-cols-2">
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
            </SectionCard>
          </div>

          <div className="grid gap-4">
            <SectionCard
              title="이용 조건"
              description="브랜드 이용 시 지켜야 할 조건을 추가합니다."
            >
              <TokenChipField
                name="conditions"
                initialValues={context.currentConditions}
                placeholder="Enter를 눌러서 조건을 추가하세요."
                helpText="조건은 줄바꿈으로 구분합니다."
                emptyText="조건을 입력해 주세요."
              />
            </SectionCard>
            <SectionCard
              title="혜택"
              description="협력사가 제공하는 할인이나 혜택을 추가합니다."
            >
              <TokenChipField
                name="benefits"
                initialValues={context.currentBenefits}
                placeholder="Enter를 눌러서 혜택을 추가하세요."
                helpText="혜택은 줄바꿈으로 구분합니다."
                emptyText="혜택을 입력해 주세요."
              />
            </SectionCard>
            <SectionCard
              title="태그"
              description="검색과 분류에 사용할 태그를 추가합니다."
            >
              <TokenChipField
                name="tags"
                initialValues={context.tags}
                placeholder="Enter를 눌러서 태그를 추가하세요."
                helpText="태그는 줄바꿈으로 구분합니다."
                emptyText="태그를 입력해 주세요."
              />
            </SectionCard>
          </div>

          <Card className="space-y-4 p-5">
            <SectionHeading
              title="적용 대상"
              description="혜택이 적용되는 대상을 선택합니다."
            />

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
          </Card>

          <div className="rounded-2xl border border-border bg-background/70 p-4">
            <p className="text-sm font-semibold text-foreground">안내</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              브랜드 정보, 혜택, 이용 조건, 태그, 적용 대상, 썸네일, 기타 이미지,
              예약/문의 링크, 브랜드 제휴 기간은 관리자 승인 후 반영됩니다. 승인 전에는
              현재 값이 그대로 유지됩니다.
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
