"use client";

import { useMemo, useState } from "react";
import Badge from "@/components/ui/Badge";
import FormMessage from "@/components/ui/FormMessage";
import SubmitButton from "@/components/ui/SubmitButton";
import Surface from "@/components/ui/Surface";
import { renderEmailBody } from "@/lib/email-content";
import type {
  NotificationTemplateAudience,
  NotificationTemplateBodyFormat,
  NotificationTemplateChannel,
  NotificationTemplateSource,
} from "@/lib/notification-templates/catalog";
import type { NotificationTemplateTestRecipientOption } from "@/lib/notification-templates/test-delivery";
import type { ResolvedNotificationTemplate } from "@/lib/notification-templates/repository.server";
import { renderNotificationTemplate } from "@/lib/notification-templates/template";

type FormAction = (formData: FormData) => void | Promise<void>;
type TemplateStatusFilter = "all" | "customized" | "default" | "legacy" | "inactive";
type TemplateChannelFilter = "all" | NotificationTemplateChannel;
type TemplateSourceFilter = "all" | NotificationTemplateSource;
type TemplateAudienceFilter = "all" | NotificationTemplateAudience;
type RequiredVariableFilter = "all" | string;

const channelLabels: Record<NotificationTemplateChannel, string> = {
  email: "이메일",
  mattermost: "Mattermost",
  push: "푸시",
  in_app: "인앱",
};

const sourceLabels: Record<NotificationTemplateSource, string> = {
  manual: "수동",
  automatic: "자동",
  transactional: "트랜잭션",
  operational: "운영",
  compatibility: "호환",
};

const audienceLabels: Record<NotificationTemplateAudience, string> = {
  member: "회원",
  admin: "관리자",
  partner: "파트너",
  recipient: "수신자",
};

const bodyFormatLabels: Record<NotificationTemplateBodyFormat, string> = {
  plain: "일반 텍스트",
  markdown: "Markdown",
  html: "제한된 HTML",
};

function getSampleValues(variables: ResolvedNotificationTemplate["variables"]) {
  return Object.fromEntries(
    variables.map((variable) => [
      variable.name,
      variable.example ?? `${variable.label} 예시`,
    ]),
  );
}

function renderSample(template: string, variables: ResolvedNotificationTemplate["variables"]) {
  try {
    return renderNotificationTemplate(template, getSampleValues(variables));
  } catch {
    return "샘플 값을 완성할 수 없습니다. 필수 변수 계약을 확인해 주세요.";
  }
}

function renderEmailSample(
  template: string,
  format: NotificationTemplateBodyFormat,
  variables: ResolvedNotificationTemplate["variables"],
) {
  try {
    return renderEmailBody(
      renderNotificationTemplate(template, getSampleValues(variables)),
      format,
    );
  } catch {
    return null;
  }
}

function insertVariable(value: string, variableName: string) {
  const token = `{${variableName}}`;
  if (value.includes(token)) {
    return value;
  }
  return `${value}${value.endsWith("\n") || !value ? "" : " "}${token}`;
}

function TemplateEditor({
  template,
  updateAction,
  resetAction,
  testAction,
  selectedTestRecipientId,
  selectedTestRecipient,
}: {
  template: ResolvedNotificationTemplate;
  updateAction: FormAction;
  resetAction: FormAction;
  testAction: FormAction;
  selectedTestRecipientId: string;
  selectedTestRecipient: NotificationTemplateTestRecipientOption | null;
}) {
  const [titleTemplate, setTitleTemplate] = useState(template.titleTemplate);
  const [bodyTemplate, setBodyTemplate] = useState(template.bodyTemplate);
  const [bodyFormat, setBodyFormat] = useState(template.bodyFormat);
  const [isOpen, setIsOpen] = useState(false);
  const emailPreview = template.channel === "email"
    ? renderEmailSample(bodyTemplate, bodyFormat, template.variables)
    : null;

  const canTestSend = Boolean(
    selectedTestRecipient
      && selectedTestRecipientId
      && selectedTestRecipient.channels.includes(template.channel),
  );

  return (
    <details
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-flat"
    >
      <summary className="flex min-w-0 cursor-pointer list-none items-start justify-between gap-3 px-4 py-4 outline-none transition hover:bg-surface-control/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary [&::-webkit-details-marker]:hidden sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="ui-section-title text-ko-title">{template.label}</h3>
            <Badge variant="primary">{channelLabels[template.channel]}</Badge>
            <Badge>{sourceLabels[template.source]}</Badge>
            <Badge>{audienceLabels[template.audience]}</Badge>
            <Badge>{bodyFormatLabels[bodyFormat]}</Badge>
            {template.isCustomized ? <Badge variant="success">수정됨</Badge> : <Badge>기본값</Badge>}
            {!template.isActive ? <Badge variant="warning">현재 발송 경로 없음</Badge> : null}
            {template.legacy ? <Badge>호환용</Badge> : null}
            {template.hasLegacyOverride ? <Badge variant="warning">이전 문구 보존됨</Badge> : null}
          </div>
          <p className="ui-body text-ko-pretty mt-1 text-sm text-muted-foreground">
            {template.description}
          </p>
          <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">
            {template.eventKey}
          </p>
          <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
            <p><span className="font-semibold text-foreground">발생 상황:</span> {template.trigger}</p>
            {template.contextKey ? <p><span className="font-semibold text-foreground">컨텍스트:</span> {template.contextKey}</p> : null}
            {template.customizationError ? <p className="text-warning">{template.customizationError}</p> : null}
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-2 pt-1 text-xs font-semibold text-muted-foreground">
          {isOpen ? "접기" : "펼치기"}
          <span aria-hidden="true" className="text-base leading-none">{isOpen ? "⌃" : "⌄"}</span>
        </span>
      </summary>

      <div className="grid min-w-0 gap-4 border-t border-border px-4 py-4 sm:px-5">
        <div className="flex justify-end">
          <form action={resetAction}>
            <input type="hidden" name="eventKey" value={template.eventKey} />
            <input type="hidden" name="channel" value={template.channel} />
            <SubmitButton variant="ghost" pendingText="복원 중" className="min-h-9 px-3 text-xs">
              기본값 복원
            </SubmitButton>
          </form>
        </div>
        <form action={updateAction} className="grid min-w-0 gap-4">
        <input type="hidden" name="eventKey" value={template.eventKey} />
        <input type="hidden" name="channel" value={template.channel} />
        {template.channel === "email" ? (
          <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-muted-foreground">
            이메일 본문 작성 형식
            <select
              name="bodyFormat"
              value={bodyFormat}
              onChange={(event) => setBodyFormat(event.target.value as NotificationTemplateBodyFormat)}
              className="min-h-11 w-full min-w-0 rounded-2xl border border-border bg-surface-control px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="plain">일반 텍스트</option>
              <option value="markdown">Markdown</option>
              <option value="html">제한된 HTML</option>
            </select>
          </label>
        ) : (
          <input type="hidden" name="bodyFormat" value="plain" />
        )}
        <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-muted-foreground">
          제목 템플릿
          <input
            name="titleTemplate"
            value={titleTemplate}
            onChange={(event) => setTitleTemplate(event.target.value)}
            className="min-h-11 w-full min-w-0 rounded-2xl border border-border bg-surface-control px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            maxLength={2000}
            required
          />
        </label>
        <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-muted-foreground">
          내용 템플릿
          <textarea
            name="bodyTemplate"
            value={bodyTemplate}
            onChange={(event) => setBodyTemplate(event.target.value)}
            className="min-h-36 w-full min-w-0 resize-y rounded-2xl border border-border bg-surface-control px-3 py-3 text-sm leading-6 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            maxLength={20000}
            required
          />
        </label>
        <div className="grid min-w-0 gap-2">
          <p className="text-xs font-semibold text-muted-foreground">사용 가능한 변수</p>
          <div className="flex min-w-0 flex-wrap gap-2">
            {template.variables.map((variable) => (
              <span key={variable.name} className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-xl border border-border bg-surface-control px-2 py-1.5 text-xs">
                <code className="break-all text-primary">{`{${variable.name}}`}</code>
                <span className="text-muted-foreground">{variable.label}</span>
                <Badge variant={template.requiredVariables.includes(variable.name) ? "primary" : "neutral"}>
                  {template.requiredVariables.includes(variable.name) ? "필수" : "선택"}
                </Badge>
                {variable.description ? <span className="basis-full text-[11px] text-muted-foreground">{variable.description}</span> : null}
                {variable.example ? <span className="basis-full text-[11px] text-muted-foreground">예: {variable.example}</span> : null}
                <button
                  type="button"
                  className="rounded-lg px-1.5 py-0.5 font-semibold text-primary transition hover:bg-primary-soft"
                  onClick={() => setTitleTemplate((current) => insertVariable(current, variable.name))}
                >
                  제목
                </button>
                <button
                  type="button"
                  className="rounded-lg px-1.5 py-0.5 font-semibold text-primary transition hover:bg-primary-soft"
                  onClick={() => setBodyTemplate((current) => insertVariable(current, variable.name))}
                >
                  내용
                </button>
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            중괄호 변수는 삭제하지 않고 유지해야 실제 발송 시 값으로 치환됩니다. {template.channel !== "email" ? "이 채널은 일반 텍스트로 전송됩니다." : bodyFormat === "markdown" ? "Markdown 문법을 사용할 수 있으며 HTML은 안전한 태그만 남습니다." : bodyFormat === "html" ? "허용 목록에 포함된 안전한 HTML 태그만 전송됩니다." : "일반 텍스트로 작성하며 줄바꿈을 유지합니다."}
          </p>
        </div>
        <div className="grid min-w-0 gap-2 rounded-2xl border border-border bg-background/60 p-3">
          <p className="text-xs font-semibold text-muted-foreground">채널별 샘플 미리보기</p>
          <div className="grid gap-3 text-sm">
            <p><span className="font-semibold text-foreground">제목:</span> {renderSample(titleTemplate, template.variables)}</p>
            {template.channel === "email" && emailPreview ? (
              <div className="grid gap-2">
                <p className="font-semibold text-foreground">이메일 HTML 미리보기</p>
                <div
                  className="min-w-0 overflow-x-auto rounded-xl border border-border bg-white p-3 text-slate-900 [&_a]:text-blue-700 [&_a]:underline"
                  dangerouslySetInnerHTML={{ __html: emailPreview.html }}
                />
                <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">일반 텍스트 fallback:</span> {emailPreview.text}
                </p>
              </div>
            ) : (
              <p className="whitespace-pre-wrap"><span className="font-semibold text-foreground">내용:</span> {renderSample(bodyTemplate, template.variables)}</p>
            )}
          </div>
        </div>
        <div className="flex justify-end">
          <SubmitButton pendingText="저장 중">저장</SubmitButton>
        </div>
        </form>
        <form action={testAction} className="grid min-w-0 gap-3 rounded-2xl border border-primary/15 bg-primary-soft/40 p-3">
          <input type="hidden" name="eventKey" value={template.eventKey} />
          <input type="hidden" name="channel" value={template.channel} />
          <input type="hidden" name="memberId" value={selectedTestRecipientId} />
          <input type="hidden" name="titleTemplate" value={titleTemplate} />
          <input type="hidden" name="bodyTemplate" value={bodyTemplate} />
          <input type="hidden" name="bodyFormat" value={bodyFormat} />
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">테스트 발송</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedTestRecipient
                  ? `${selectedTestRecipient.label}에게 ${channelLabels[template.channel]}로 현재 문구를 보냅니다.`
                  : "위에서 테스트 수신 회원을 선택해 주세요."}
              </p>
            </div>
            <SubmitButton
              variant="soft"
              pendingText="발송 중"
              disabled={!canTestSend}
              className="min-h-10 px-3 text-xs"
            >
              테스트 발송
            </SubmitButton>
          </div>
          {selectedTestRecipient && !selectedTestRecipient.channels.includes(template.channel) ? (
            <p className="text-xs text-warning">
              선택한 회원에게 등록된 {channelLabels[template.channel]} 수신 경로가 없어 발송할 수 없습니다.
            </p>
          ) : null}
        </form>
      </div>
    </details>
  );
}

export default function AdminNotificationTemplateManager({
  templates,
  updateAction,
  resetAction,
  testAction,
  testRecipients,
  defaultTestRecipientId,
  statusMessage,
  errorMessage,
}: {
  templates: ResolvedNotificationTemplate[];
  updateAction: FormAction;
  resetAction: FormAction;
  testAction: FormAction;
  testRecipients: NotificationTemplateTestRecipientOption[];
  defaultTestRecipientId: string | null;
  statusMessage?: string | null;
  errorMessage?: string | null;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<TemplateChannelFilter>("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<TemplateStatusFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<TemplateSourceFilter>("all");
  const [audienceFilter, setAudienceFilter] = useState<TemplateAudienceFilter>("all");
  const [requiredVariableFilter, setRequiredVariableFilter] = useState<RequiredVariableFilter>("all");
  const [testRecipientId, setTestRecipientId] = useState(defaultTestRecipientId ?? "");

  const groupOptions = useMemo(
    () => [...new Set(templates.map((template) => template.group))],
    [templates],
  );
  const requiredVariableOptions = useMemo(
    () => [...new Set(templates.flatMap((template) => template.requiredVariables))].sort(),
    [templates],
  );

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();

    return templates.filter((template) => {
      const searchableText = [
        template.label,
        template.description,
        template.group,
        template.eventKey,
        template.titleTemplate,
        template.bodyTemplate,
        ...template.variables.flatMap((variable) => [variable.name, variable.label]),
        channelLabels[template.channel],
        sourceLabels[template.source],
        audienceLabels[template.audience],
        template.trigger,
        template.contextKey ?? "",
      ]
        .join(" ")
        .toLocaleLowerCase();

      const matchesSearch = !normalizedQuery || searchableText.includes(normalizedQuery);
      const matchesChannel = channelFilter === "all" || template.channel === channelFilter;
      const matchesGroup = groupFilter === "all" || template.group === groupFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "customized"
          ? template.isCustomized
          : statusFilter === "legacy"
            ? template.legacy || template.hasLegacyOverride
            : statusFilter === "inactive"
              ? !template.isActive
              : !template.isCustomized && !template.legacy && !template.hasLegacyOverride);
      const matchesSource = sourceFilter === "all" || template.source === sourceFilter;
      const matchesAudience = audienceFilter === "all" || template.audience === audienceFilter;
      const matchesRequiredVariable =
        requiredVariableFilter === "all" || template.requiredVariables.includes(requiredVariableFilter);

      return matchesSearch && matchesChannel && matchesGroup && matchesStatus && matchesSource && matchesAudience && matchesRequiredVariable;
    });
  }, [audienceFilter, channelFilter, groupFilter, requiredVariableFilter, searchQuery, sourceFilter, statusFilter, templates]);

  const selectedTestRecipient = testRecipients.find(
    (recipient) => recipient.id === testRecipientId,
  ) ?? null;

  const groups = useMemo(() => {
    const grouped = new Map<string, ResolvedNotificationTemplate[]>();
    for (const template of filteredTemplates) {
      const entries = grouped.get(template.group) ?? [];
      entries.push(template);
      grouped.set(template.group, entries);
    }
    return [...grouped.entries()];
  }, [filteredTemplates]);

  const hasActiveFilters =
    Boolean(searchQuery) ||
    channelFilter !== "all" ||
    groupFilter !== "all" ||
    statusFilter !== "all" ||
    sourceFilter !== "all" ||
    audienceFilter !== "all" ||
    requiredVariableFilter !== "all";

  const resetFilters = () => {
    setSearchQuery("");
    setChannelFilter("all");
    setGroupFilter("all");
    setStatusFilter("all");
    setSourceFilter("all");
    setAudienceFilter("all");
    setRequiredVariableFilter("all");
  };

  return (
    <div className="grid min-w-0 gap-6">
      {statusMessage ? <FormMessage variant="info">{statusMessage}</FormMessage> : null}
      {errorMessage ? <FormMessage variant="error">{errorMessage}</FormMessage> : null}
      <Surface level="inset" padding="md" className="grid min-w-0 gap-3">
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
          <div className="min-w-0">
            <h2 className="ui-section-title text-ko-title">템플릿 찾기</h2>
            <p className="ui-body mt-1 text-sm text-muted-foreground">
              이름, 설명, 이벤트 키, 제목·내용의 변수까지 검색할 수 있습니다.
            </p>
          </div>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            검색 결과 {filteredTemplates.length}개 / 전체 {templates.length}개
          </p>
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-muted-foreground sm:col-span-2 lg:col-span-4">
            검색어
            <input
              aria-label="템플릿 검색"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="이름, 설명, 이벤트 키, 제목·내용 검색"
              className="min-h-11 w-full min-w-0 rounded-2xl border border-border bg-surface-control px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-muted-foreground">
            채널
            <select
              aria-label="채널 필터"
              value={channelFilter}
              onChange={(event) => setChannelFilter(event.target.value as TemplateChannelFilter)}
              className="min-h-11 w-full min-w-0 rounded-2xl border border-border bg-surface-control px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">전체 채널</option>
              {Object.entries(channelLabels).map(([channel, label]) => (
                <option key={channel} value={channel}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-muted-foreground">
            그룹
            <select
              aria-label="그룹 필터"
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value)}
              className="min-h-11 w-full min-w-0 rounded-2xl border border-border bg-surface-control px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">전체 그룹</option>
              {groupOptions.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-muted-foreground">
            상태
            <select
              aria-label="상태 필터"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as TemplateStatusFilter)}
              className="min-h-11 w-full min-w-0 rounded-2xl border border-border bg-surface-control px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">전체 상태</option>
              <option value="default">기본값</option>
              <option value="customized">수정됨</option>
              <option value="legacy">호환용</option>
              <option value="inactive">현재 발송 경로 없음</option>
            </select>
          </label>
          <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-muted-foreground">
            필수 변수
            <select
              aria-label="필수 변수 필터"
              value={requiredVariableFilter}
              onChange={(event) => setRequiredVariableFilter(event.target.value)}
              className="min-h-11 w-full min-w-0 rounded-2xl border border-border bg-surface-control px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">전체 필수 변수</option>
              {requiredVariableOptions.map((name) => <option key={name} value={name}>{`{${name}}`}</option>)}
            </select>
          </label>
          <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-muted-foreground">
            출처
            <select
              aria-label="출처 필터"
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value as TemplateSourceFilter)}
              className="min-h-11 w-full min-w-0 rounded-2xl border border-border bg-surface-control px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">전체 출처</option>
              {Object.entries(sourceLabels).map(([source, label]) => <option key={source} value={source}>{label}</option>)}
            </select>
          </label>
          <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-muted-foreground">
            대상
            <select
              aria-label="대상 필터"
              value={audienceFilter}
              onChange={(event) => setAudienceFilter(event.target.value as TemplateAudienceFilter)}
              className="min-h-11 w-full min-w-0 rounded-2xl border border-border bg-surface-control px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">전체 대상</option>
              {Object.entries(audienceLabels).map(([audience, label]) => <option key={audience} value={audience}>{label}</option>)}
            </select>
          </label>
          <div className="flex min-w-0 items-end sm:justify-end">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="min-h-11 rounded-2xl px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary-soft"
              >
                필터 초기화
              </button>
            ) : null}
          </div>
        </div>
      </Surface>
      <Surface level="inset" padding="md" className="grid min-w-0 gap-2">
        <div className="min-w-0">
          <h2 className="ui-section-title text-ko-title">테스트 발송 수신 회원</h2>
          <p className="ui-body mt-1 text-sm text-muted-foreground">
            기본값은 Super Admin <code className="rounded bg-surface-control px-1">myknow</code>입니다. 각 템플릿을 펼친 뒤 현재 문구를 선택한 회원에게 실제 채널로 발송할 수 있습니다.
          </p>
        </div>
        <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-muted-foreground">
          수신 회원
          <select
            aria-label="테스트 발송 수신 회원"
            value={testRecipientId}
            onChange={(event) => setTestRecipientId(event.target.value)}
            className="min-h-11 w-full min-w-0 rounded-2xl border border-border bg-surface-control px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            disabled={testRecipients.length === 0}
          >
            <option value="">수신 회원을 선택해 주세요</option>
            {testRecipients.map((recipient) => (
              <option key={recipient.id} value={recipient.id}>
                {recipient.label}
              </option>
            ))}
          </select>
        </label>
        {selectedTestRecipient ? (
          <p className="text-xs text-muted-foreground">
            사용 가능한 경로: {selectedTestRecipient.channels.map((channel) => channelLabels[channel]).join(", ")}
          </p>
        ) : (
          <p className="text-xs text-warning">활성 회원이 없어 테스트 발송을 사용할 수 없습니다.</p>
        )}
      </Surface>
      {groups.length > 0 ? (
        groups.map(([group, groupTemplates]) => (
          <section key={group} className="grid min-w-0 gap-3">
            <div className="flex min-w-0 items-end justify-between gap-3">
              <h2 className="ui-section-title text-ko-title">{group}</h2>
              <span className="text-xs text-muted-foreground">{groupTemplates.length}개 템플릿</span>
            </div>
            <div className="grid min-w-0 gap-3">
              {groupTemplates.map((template) => (
                <TemplateEditor
                  key={`${template.eventKey}:${template.channel}`}
                  template={template}
                  updateAction={updateAction}
                  resetAction={resetAction}
                  testAction={testAction}
                  selectedTestRecipientId={testRecipientId}
                  selectedTestRecipient={selectedTestRecipient}
                />
              ))}
            </div>
          </section>
        ))
      ) : (
        <Surface level="inset" padding="lg" className="grid min-w-0 gap-2 text-center">
          <p className="font-semibold text-foreground">조건에 맞는 템플릿이 없습니다.</p>
          <p className="text-sm text-muted-foreground">검색어나 필터를 바꿔보세요.</p>
          <div>
            <button
              type="button"
              onClick={resetFilters}
              className="min-h-11 rounded-2xl px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary-soft"
            >
              필터 초기화
            </button>
          </div>
        </Surface>
      )}
      <Surface level="inset" padding="md" className="grid gap-2 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">관리자 작성형 알림</p>
        <p>발송 관리 화면에서 직접 작성하는 공지는 입력한 제목·내용을 기본값으로 사용하며, 자동·운영 알림은 위 템플릿을 적용합니다.</p>
      </Surface>
    </div>
  );
}
