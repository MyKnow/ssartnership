"use client";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import SectionHeading from "@/components/ui/SectionHeading";
import SubmitButton from "@/components/ui/SubmitButton";
import PartnerAudienceChips from "@/components/PartnerAudienceChips";
import type { PartnerChangeRequestSummary } from "@/lib/partner-change-requests";

function ListChips({
  values,
  emptyText,
}: {
  values: string[];
  emptyText: string;
}) {
  if (values.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <Badge key={value} className="bg-surface text-foreground">
          {value}
        </Badge>
      ))}
    </div>
  );
}

function SummaryBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function SummaryRows({
  rows,
}: {
  rows: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <div
          key={row.label}
          className="rounded-2xl border border-border bg-background/70 px-4 py-3"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {row.label}
          </p>
          <div className="mt-2 break-all text-sm leading-6 text-foreground">
            {row.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PartnerChangeRequestQueue({
  requests,
  approveAction,
  rejectAction,
}: {
  requests: PartnerChangeRequestSummary[];
  approveAction: (formData: FormData) => void | Promise<void>;
  rejectAction: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <Card className="space-y-6">
      <SectionHeading
        title="승인 대기 요청"
        description="브랜드 정보, 혜택, 이용 조건, 태그, 적용 대상, 썸네일, 기타 이미지, 예약/문의 링크, 브랜드 제휴 기간 변경 요청을 이곳에서 승인하거나 거절합니다."
      />

      {requests.length === 0 ? (
        <EmptyState
          title="승인 대기 요청이 없습니다."
          description="협력사 담당자가 민감 정보 변경 요청을 보내면 이곳에 표시됩니다."
        />
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <article
              key={request.id}
              className="space-y-4 rounded-3xl border border-border bg-surface-muted p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-amber-500/10 text-amber-700">
                      승인 대기
                    </Badge>
                    <Badge className="bg-surface text-foreground">
                      {request.companyName}
                    </Badge>
                    <Badge className="bg-surface text-foreground">
                      {request.categoryLabel}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-foreground">
                      {request.partnerName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {request.partnerLocation}
                    </p>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground">
                  <p>
                    요청자{" "}
                    <span className="font-medium text-foreground">
                      {request.requestedByDisplayName ??
                        request.requestedByLoginId ??
                        "미지정"}
                    </span>
                  </p>
                  <p className="mt-1">
                    요청 시각 {new Date(request.createdAt).toLocaleString("ko-KR")}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-3">
                <SummaryBlock label="현재 조건">
                  <ListChips
                    values={request.currentConditions}
                    emptyText="조건이 없습니다."
                  />
                </SummaryBlock>
                <SummaryBlock label="요청 조건">
                  <ListChips
                    values={request.requestedConditions}
                    emptyText="조건이 없습니다."
                  />
                </SummaryBlock>
                <SummaryBlock label="적용 대상">
                  <div className="space-y-3">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      현재
                    </p>
                    <PartnerAudienceChips appliesTo={request.currentAppliesTo} />
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      요청
                    </p>
                    <PartnerAudienceChips appliesTo={request.requestedAppliesTo} />
                  </div>
                </SummaryBlock>
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                <SummaryBlock label="현재 브랜드 정보">
                  <SummaryRows
                    rows={[
                      {
                        label: "브랜드명",
                        value: request.currentPartnerName,
                      },
                      {
                        label: "위치",
                        value: request.currentPartnerLocation,
                      },
                      {
                        label: "지도 URL",
                        value: request.currentMapUrl ?? "없음",
                      },
                    ]}
                  />
                </SummaryBlock>
                <SummaryBlock label="요청 브랜드 정보">
                  <SummaryRows
                    rows={[
                      {
                        label: "브랜드명",
                        value: request.requestedPartnerName,
                      },
                      {
                        label: "위치",
                        value: request.requestedPartnerLocation,
                      },
                      {
                        label: "지도 URL",
                        value: request.requestedMapUrl ?? "없음",
                      },
                    ]}
                  />
                </SummaryBlock>
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                <SummaryBlock label="현재 혜택">
                  <ListChips
                    values={request.currentBenefits}
                    emptyText="혜택이 없습니다."
                  />
                </SummaryBlock>
                <SummaryBlock label="요청 혜택">
                  <ListChips
                    values={request.requestedBenefits}
                    emptyText="혜택이 없습니다."
                  />
                </SummaryBlock>
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                <SummaryBlock label="현재 태그">
                  <ListChips
                    values={request.currentTags}
                    emptyText="태그가 없습니다."
                  />
                </SummaryBlock>
                <SummaryBlock label="요청 태그">
                  <ListChips
                    values={request.requestedTags}
                    emptyText="태그가 없습니다."
                  />
                </SummaryBlock>
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                <SummaryBlock label="현재 이미지 / 링크 / 기간">
                  <SummaryRows
                    rows={[
                      {
                        label: "썸네일",
                        value: request.currentThumbnail ? "등록됨" : "없음",
                      },
                      {
                        label: "기타 이미지",
                        value:
                          request.currentImages.length > 0
                            ? `${request.currentImages.length}장`
                            : "없음",
                      },
                      {
                        label: "예약 링크",
                        value: request.currentReservationLink ?? "없음",
                      },
                      {
                        label: "문의 링크",
                        value: request.currentInquiryLink ?? "없음",
                      },
                      {
                        label: "기간",
                        value: `${request.currentPeriodStart ?? "미정"} ~ ${request.currentPeriodEnd ?? "미정"}`,
                      },
                    ]}
                  />
                </SummaryBlock>
                <SummaryBlock label="요청 이미지 / 링크 / 기간">
                  <SummaryRows
                    rows={[
                      {
                        label: "썸네일",
                        value: request.requestedThumbnail ? "등록됨" : "없음",
                      },
                      {
                        label: "기타 이미지",
                        value:
                          request.requestedImages.length > 0
                            ? `${request.requestedImages.length}장`
                            : "없음",
                      },
                      {
                        label: "예약 링크",
                        value: request.requestedReservationLink ?? "없음",
                      },
                      {
                        label: "문의 링크",
                        value: request.requestedInquiryLink ?? "없음",
                      },
                      {
                        label: "기간",
                        value: `${request.requestedPeriodStart ?? "미정"} ~ ${request.requestedPeriodEnd ?? "미정"}`,
                      },
                    ]}
                  />
                </SummaryBlock>
              </div>

              <div className="flex flex-wrap gap-3">
                <form action={approveAction}>
                  <input type="hidden" name="requestId" value={request.id} />
                  <SubmitButton pendingText="승인 중">승인</SubmitButton>
                </form>
                <form action={rejectAction}>
                  <input type="hidden" name="requestId" value={request.id} />
                  <SubmitButton variant="danger" pendingText="거절 중">
                    거절
                  </SubmitButton>
                </form>
                <Button
                  href={`/partner/services/${encodeURIComponent(request.partnerId)}?mode=edit`}
                  variant="ghost"
                >
                  상세/수정 보기
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}
