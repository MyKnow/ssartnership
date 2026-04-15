"use client";

import Button from "@/components/ui/Button";
import FilterBar from "@/components/ui/FilterBar";
import FormMessage from "@/components/ui/FormMessage";
import InlineMessage from "@/components/ui/InlineMessage";
import Input from "@/components/ui/Input";
import SectionHeading from "@/components/ui/SectionHeading";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { formatSsafyYearLabel } from "@/lib/ssafy-year";
import type { PushAudienceScope } from "@/lib/push";
import type { AdminPushManagerProps } from "./types";

type Props = {
  configured: boolean;
  errorMessage: string | null;
  targetableCount: number;
  pending: boolean;
  audienceYearOptions: number[];
  campusOptions: string[];
  composer: {
    title: string;
    body: string;
    url: string;
    selectedPartnerId: string;
    audienceScope: PushAudienceScope;
    selectedYear: string;
    selectedCampus: string;
    selectedMemberId: string;
  };
  partners: AdminPushManagerProps["partners"];
  members: AdminPushManagerProps["members"];
  getMemberLabel: (member: AdminPushManagerProps["members"][number]) => string;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onUpdateComposer: (
    key:
      | "title"
      | "body"
      | "url"
      | "selectedYear"
      | "selectedCampus"
      | "selectedMemberId",
    value: string,
  ) => void;
  onPartnerChange: (partnerId: string) => void;
  onUrlChange: (nextUrl: string) => void;
  onAudienceScopeChange: (scope: PushAudienceScope) => void;
};

export function PushComposerSection({
  audienceYearOptions,
  campusOptions,
  composer,
  configured,
  errorMessage,
  getMemberLabel,
  members,
  onAudienceScopeChange,
  onPartnerChange,
  onSubmit,
  onUpdateComposer,
  onUrlChange,
  partners,
  pending,
  targetableCount,
}: Props) {
  return (
    <section className="grid min-w-0 gap-4 overflow-hidden rounded-3xl border border-border bg-surface-muted/50 p-4 sm:p-5">
      <SectionHeading
        title="공지 메시지 작성"
        description="발송 대상을 먼저 정하고, 직접 URL 입력 또는 등록된 제휴 업체 선택으로 이동 경로를 구성합니다."
      />

      {errorMessage ? <FormMessage variant="error">{errorMessage}</FormMessage> : null}

      {!configured ? (
        <InlineMessage
          tone="warning"
          title="푸시 설정이 아직 완성되지 않았습니다."
          description="VAPID 환경 변수와 CRON 시크릿이 준비되어야 수동 발송과 자동 발송을 모두 안정적으로 운영할 수 있습니다."
        />
      ) : null}

      <form className="grid gap-4" onSubmit={onSubmit}>
        <FilterBar
          title="발송 대상"
          description="전체, 기수, 캠퍼스, 개인 단위로 메시지 도달 범위를 지정합니다."
        >
          <label className="grid min-w-[10rem] gap-2 text-sm font-medium text-foreground">
            대상 범위
            <Select
              value={composer.audienceScope}
              onChange={(event) =>
                onAudienceScopeChange(event.target.value as PushAudienceScope)
              }
            >
              <option value="all">전체</option>
              <option value="year">기수</option>
              <option value="campus">캠퍼스</option>
              <option value="member">개인</option>
            </Select>
          </label>

          <label className="grid min-w-[10rem] gap-2 text-sm font-medium text-foreground">
            기수
            <Select
              value={composer.selectedYear}
              disabled={composer.audienceScope !== "year"}
              onChange={(event) => onUpdateComposer("selectedYear", event.target.value)}
            >
              <option value="">기수 선택</option>
              {audienceYearOptions.map((year) => (
                <option key={year} value={String(year)}>
                  {formatSsafyYearLabel(year)}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid min-w-[10rem] gap-2 text-sm font-medium text-foreground">
            캠퍼스
            <Select
              value={composer.selectedCampus}
              disabled={
                composer.audienceScope === "all" ||
                composer.audienceScope === "year" ||
                composer.audienceScope === "member"
              }
              onChange={(event) => onUpdateComposer("selectedCampus", event.target.value)}
            >
              <option value="">캠퍼스 선택</option>
              {campusOptions.map((campus) => (
                <option key={campus} value={campus}>
                  {campus}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid min-w-[12rem] flex-1 gap-2 text-sm font-medium text-foreground">
            개인
            <Select
              value={composer.selectedMemberId}
              disabled={composer.audienceScope !== "member"}
              onChange={(event) => onUpdateComposer("selectedMemberId", event.target.value)}
            >
              <option value="">개인 선택</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {getMemberLabel(member)}
                </option>
              ))}
            </Select>
          </label>
        </FilterBar>

        <div className="grid min-w-0 gap-4 rounded-2xl border border-border bg-surface px-4 py-4">
          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <label className="grid gap-2 text-sm font-medium text-foreground">
              제목
              <Input
                value={composer.title}
                onChange={(event) => onUpdateComposer("title", event.target.value)}
                placeholder="알림 제목"
                maxLength={60}
                required
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-foreground">
              가게 상세 페이지 선택
              <Select
                value={composer.selectedPartnerId}
                onChange={(event) => onPartnerChange(event.target.value)}
              >
                <option value="">직접 URL 입력</option>
                {partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.name}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <label className="grid gap-2 text-sm font-medium text-foreground">
            내용
            <Textarea
              value={composer.body}
              onChange={(event) => onUpdateComposer("body", event.target.value)}
              placeholder="알림 내용"
              rows={4}
              maxLength={160}
              required
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-foreground">
            이동 URL
            <Input
              value={composer.url}
              onChange={(event) => onUrlChange(event.target.value)}
              placeholder="예: /partners/uuid 또는 https://..."
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid min-w-0 gap-1">
            <p className="text-sm text-muted-foreground">
              신규 제휴와 종료 7일 전 알림은 자동 발송되며, 수동 공지는 위 대상 범위에 맞춰 발송됩니다.
            </p>
            <p className="text-xs font-medium text-muted-foreground">
              예상 발송 대상 {targetableCount}명
            </p>
          </div>
          <Button
            type="submit"
            className="w-full justify-center sm:w-auto"
            loading={pending}
            loadingText="공지 발송 중"
            disabled={!configured || targetableCount === 0}
          >
            공지 발송
          </Button>
        </div>
      </form>
    </section>
  );
}
