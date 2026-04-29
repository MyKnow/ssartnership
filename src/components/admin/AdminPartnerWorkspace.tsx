"use client";

import { useState } from "react";
import AdminPartnerManager from "@/components/admin/AdminPartnerManager";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import SectionHeading from "@/components/ui/SectionHeading";
import SubmitButton from "@/components/ui/SubmitButton";
import Tabs from "@/components/ui/Tabs";
import InlineMessage from "@/components/ui/InlineMessage";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import { ADMIN_COPY } from "@/lib/content";
import { cn } from "@/lib/cn";
import { type Action } from "react";
import type { AdminCategory, AdminPartner } from "@/components/admin/partner-manager/types";
import type { PartnerChangeRequestSummary } from "@/lib/partner-change-requests";
import { formatKoreanDateTimeToMinute } from "@/lib/datetime";
import { buildPartnerChangeRequestDiffItems } from "@/components/partner-change-request-ui/buildDiffItems";
import { DiffCard } from "@/components/partner-change-request-ui/DiffPrimitives";

function FieldGroup({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("min-w-0", className)}>
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function PartnerChangeRequestCard({
  request,
  approveAction,
  rejectAction,
}: {
  request: PartnerChangeRequestSummary;
  approveAction: (formData: FormData) => void | Promise<void>;
  rejectAction: (formData: FormData) => void | Promise<void>;
}) {
  const diffItems = buildPartnerChangeRequestDiffItems(request);

  return (
    <article className="space-y-4 rounded-3xl border border-border bg-surface-muted p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-amber-500/10 text-amber-700">승인 대기</Badge>
            <Badge className="bg-surface text-foreground">{request.companyName}</Badge>
            <Badge className="bg-surface text-foreground">{request.categoryLabel}</Badge>
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{request.partnerName}</p>
            <p className="text-sm text-muted-foreground">{request.partnerLocation}</p>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          <p>
            요청자{" "}
            <span className="font-medium text-foreground">
              {request.requestedByDisplayName ?? request.requestedByLoginId ?? "미지정"}
            </span>
          </p>
          <p className="mt-1">
            요청 시각 {formatKoreanDateTimeToMinute(request.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {diffItems.map((item) => (
          <DiffCard
            key={item.key}
            label={item.label}
            current={item.current}
            requested={item.requested}
          />
        ))}
      </div>

      {diffItems.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface-inset/85 px-4 py-3 text-sm text-muted-foreground">
          변경된 항목이 없습니다.
        </div>
      ) : null}

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
      </div>
    </article>
  );
}

function PartnerChangeRequestQueueSection({
  requests,
  approveAction,
  rejectAction,
}: {
  requests: PartnerChangeRequestSummary[];
  approveAction: Action;
  rejectAction: Action;
}) {
  return (
    <Card className="space-y-6 min-w-0">
      <SectionHeading
        title="승인 대기 요청"
        description="변경된 항목만 현재값과 요청값으로 비교한 뒤 승인하거나 거절합니다."
      />

      {requests.length === 0 ? (
        <EmptyState
          title="승인 대기 요청이 없습니다."
          description="협력사 담당자가 민감 정보 변경 요청을 보내면 이곳에 표시됩니다."
        />
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <PartnerChangeRequestCard
              key={request.id}
              request={request}
              approveAction={approveAction}
              rejectAction={rejectAction}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function CategoryManagerSection({
  categories,
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
}: {
  categories: AdminCategory[];
  createCategoryAction: Action;
  updateCategoryAction: Action;
  deleteCategoryAction: Action;
}) {
  return (
    <Card tone="elevated" className="min-w-0">
      <SectionHeading
        title="카테고리 관리"
        description="카테고리 키는 소문자 영문/숫자 조합을 권장합니다."
      />

      <form
        className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.4fr)_auto_auto] lg:items-end"
        action={createCategoryAction}
      >
        <div className="grid grid-cols-2 gap-4 lg:contents">
          <FieldGroup label="카테고리 키" className="min-w-0">
            <Input name="key" placeholder="category-key" required />
          </FieldGroup>
          <FieldGroup label="라벨" className="min-w-0">
            <Input name="label" placeholder="라벨" required />
          </FieldGroup>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_92px] gap-4 lg:contents">
          <FieldGroup label="설명" className="min-w-0">
            <Input name="description" placeholder="설명" />
          </FieldGroup>
          <FieldGroup label="색상">
            <input
              type="color"
              name="color"
              defaultValue="#0f172a"
              className="h-12 w-full cursor-pointer rounded-2xl border border-border bg-surface-control p-1"
              title="카테고리 색상"
            />
          </FieldGroup>
        </div>
        <div className="flex justify-end lg:justify-start">
          <SubmitButton pendingText="추가 중" className="w-full sm:w-auto">
            추가
          </SubmitButton>
        </div>
      </form>

      <div className="mt-6 grid gap-3">
        {categories.length === 0 ? (
          <EmptyState
            title={ADMIN_COPY.emptyCategoryTitle}
            description={ADMIN_COPY.emptyCategoryDescription}
          />
        ) : (
          categories.map((category) => (
            (() => {
              const updateFormId = `category-update-${category.id}`;
              const deleteFormId = `category-delete-${category.id}`;

              return (
                <div
                  key={category.id}
                  className="rounded-2xl border border-border bg-surface-elevated p-4"
                >
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.4fr)_auto_auto_auto] lg:items-end">
                    <form
                      id={updateFormId}
                      className="contents"
                      action={updateCategoryAction}
                    >
                      <input type="hidden" name="id" value={category.id} />
                      <div className="grid grid-cols-2 gap-4 lg:contents">
                        <FieldGroup label="카테고리 키" className="min-w-0">
                          <Input name="key" defaultValue={category.key} />
                        </FieldGroup>
                        <FieldGroup label="라벨" className="min-w-0">
                          <Input name="label" defaultValue={category.label} />
                        </FieldGroup>
                      </div>
                      <div className="grid grid-cols-[minmax(0,1fr)_92px] gap-4 lg:contents">
                        <FieldGroup label="설명" className="min-w-0">
                          <Input
                            name="description"
                            defaultValue={category.description ?? ""}
                          />
                        </FieldGroup>
                        <FieldGroup label="색상">
                          <input
                            type="color"
                            name="color"
                            defaultValue={category.color ?? "#0f172a"}
                            className="h-12 w-full cursor-pointer rounded-2xl border border-border bg-surface-control p-1"
                            title="카테고리 색상"
                          />
                        </FieldGroup>
                      </div>
                    </form>
                    <form
                      id={deleteFormId}
                      className="contents"
                      action={deleteCategoryAction}
                    >
                      <input type="hidden" name="id" value={category.id} />
                    </form>
                    <div className="flex justify-end gap-2 lg:justify-start">
                      <SubmitButton
                        form={updateFormId}
                        variant="ghost"
                        pendingText="수정 중"
                        className="w-full sm:w-auto"
                      >
                        수정
                      </SubmitButton>
                      <SubmitButton
                        form={deleteFormId}
                        variant="danger"
                        pendingText="삭제 중"
                        className="w-full sm:w-auto"
                      >
                        삭제
                      </SubmitButton>
                    </div>
                  </div>
                </div>
              );
            })()
          ))
        )}
      </div>
    </Card>
  );
}

export default function AdminPartnerWorkspace({
  categories,
  partners,
  changeRequests,
  partnerMetrics,
  approveAction,
  rejectAction,
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
}: {
  categories: AdminCategory[];
  partners: AdminPartner[];
  changeRequests: PartnerChangeRequestSummary[];
  partnerMetrics: {
    warningMessage: string | null;
    metricsByPartnerId: Map<string, AdminPartner["metrics"]>;
  };
  approveAction: Action;
  rejectAction: Action;
  createCategoryAction: Action;
  updateCategoryAction: Action;
  deleteCategoryAction: Action;
}) {
  const [activeTab, setActiveTab] = useState<"brand" | "category">("brand");
  const safePartners = partners.map((partner) => ({
    ...partner,
    metrics: partnerMetrics.metricsByPartnerId.get(partner.id) ?? null,
  }));

  return (
    <div className="grid gap-6">
      <Tabs
        value={activeTab}
        onChange={(value) => setActiveTab(value)}
        options={[
          {
            value: "brand",
            label: "브랜드 관리",
            description: `브랜드 ${safePartners.length.toLocaleString()}개 · 승인 대기 ${changeRequests.length.toLocaleString()}건`,
          },
          {
            value: "category",
            label: "카테고리 관리",
            description: `카테고리 ${categories.length.toLocaleString()}개`,
          },
        ]}
        className="sm:grid-cols-2"
      />

      {activeTab === "brand" ? (
        <div className="grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,0.72fr)] 2xl:items-start">
          <Card tone="elevated" className="min-w-0">
            <SectionHeading
              title="브랜드 관리"
              description="협력사와 담당자 이메일을 함께 관리하고, 이용 조건/혜택/태그는 칩으로 다룹니다."
            />
            {partnerMetrics.warningMessage ? (
              <InlineMessage
                className="mt-6"
                tone="warning"
                title="브랜드 집계 일부를 불러오지 못했습니다."
                description={partnerMetrics.warningMessage}
              />
            ) : null}
            <div className="mt-6">
              <AdminPartnerManager
                categories={categories}
                partners={safePartners}
              />
            </div>
          </Card>

          <div className="grid min-w-0 gap-6 2xl:sticky 2xl:top-24">
            <PartnerChangeRequestQueueSection
              requests={changeRequests}
              approveAction={approveAction}
              rejectAction={rejectAction}
            />
          </div>
        </div>
      ) : (
        <CategoryManagerSection
          categories={categories}
          createCategoryAction={createCategoryAction}
          updateCategoryAction={updateCategoryAction}
          deleteCategoryAction={deleteCategoryAction}
        />
      )}
    </div>
  );
}
