"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { parseSsafyProfile } from "@/lib/mm-profile";
import { formatKoreanDateTimeToMinute } from "@/lib/datetime";
import {
  formatSsafyMemberLifecycleLabel,
  formatSsafyYearLabel,
  getCurrentSsafyYear,
} from "@/lib/ssafy-year";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import SubmitButton from "@/components/ui/SubmitButton";
import type { AdminMember } from "@/components/admin/member-manager/selectors";

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return formatKoreanDateTimeToMinute(parsed);
}

function getConsentLabel(kind: "service" | "privacy" | "marketing") {
  switch (kind) {
    case "service":
      return "서비스 이용약관";
    case "privacy":
      return "개인정보 처리방침";
    case "marketing":
      return "마케팅 정보 수신";
  }
}

function NotificationPreferenceItem({
  label,
  enabled,
}: {
  label: string;
  enabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-surface-inset/80 px-3 py-3">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span
        className={
          enabled
            ? "text-xs font-semibold text-emerald-600 dark:text-emerald-300"
            : "text-xs font-semibold text-muted-foreground"
        }
      >
        {enabled ? "켜짐" : "꺼짐"}
      </span>
    </div>
  );
}

export default function AdminMemberListItem({
  member,
  updateAction,
  deleteAction,
}: {
  member: AdminMember;
  updateAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);

  const profile = parseSsafyProfile(member.display_name ?? member.mm_username);
  const displayName =
    profile.displayName ?? member.display_name ?? member.mm_username;
  const year = member.year ?? getCurrentSsafyYear();
  const yearLabel = formatSsafyMemberLifecycleLabel(year);
  const staffSourceYear = member.staff_source_year ?? null;
  const campus = member.campus ?? profile.campus ?? "";
  const avatarSrc =
    member.avatar_base64 && member.avatar_content_type
      ? `data:${member.avatar_content_type};base64,${member.avatar_base64}`
      : "/avatar-default.svg";
  const updateFormId = `member-update-${member.id}`;
  const notificationPreferences = member.notification_preferences;

  const consentHistory = useMemo(
    () =>
      [...(member.consent_history ?? [])].sort(
        (a, b) => new Date(b.agreed_at).getTime() - new Date(a.agreed_at).getTime(),
      ),
    [member.consent_history],
  );

  const handleDeleteSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const ok = window.confirm(
      `정말 ${displayName}(@${member.mm_username}) 회원을 삭제하시겠습니까?`,
    );
    if (!ok) {
      event.preventDefault();
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="grid w-full grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-surface-muted/50"
      >
        <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-border bg-surface-muted">
          <Image
            src={avatarSrc}
            alt={`${displayName} 프로필 이미지`}
            fill
            sizes="56px"
            unoptimized
            className="object-cover"
          />
        </div>

        <div className="grid min-w-0 gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="truncate text-base font-semibold text-foreground">{displayName}</p>
            <p className="truncate text-sm text-muted-foreground">@{member.mm_username}</p>
            {member.must_change_password ? (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                비밀번호 변경 필요
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{yearLabel}</span>
            <span>{campus || "캠퍼스 미입력"}</span>
            <span>가입 {formatDateTime(member.created_at)}</span>
            <span>수정 {formatDateTime(member.updated_at)}</span>
          </div>
        </div>

        <span className="text-sm font-medium text-muted-foreground">
          {expanded ? "접기" : "상세"}
        </span>
      </button>

      {expanded ? (
        <div className="border-t border-border px-4 py-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <div className="grid gap-4">
              <div className="grid gap-3 rounded-2xl border border-border bg-surface-muted/40 px-4 py-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-foreground">MM User ID</span>
                  <span className="break-all text-muted-foreground">{member.mm_user_id}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-foreground">기수</span>
                  <span className="text-muted-foreground">{yearLabel}</span>
                </div>
                {year === 0 && staffSourceYear !== null ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-foreground">찾은 기수</span>
                    <span className="text-muted-foreground">
                      {formatSsafyYearLabel(staffSourceYear)}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-foreground">캠퍼스</span>
                  <span className="text-muted-foreground">{campus || "-"}</span>
                </div>
              </div>

              <div className="grid gap-3 rounded-2xl border border-border bg-surface-muted/40 px-4 py-4">
                <div className="grid gap-1">
                  <p className="text-sm font-semibold text-foreground">동의 이력</p>
                  <p className="text-sm text-muted-foreground">
                    각 약관의 최신 동의 여부와 기록된 동의 내역을 함께 보여줍니다.
                  </p>
                </div>
                {consentHistory.length === 0 ? (
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="grid gap-1 rounded-2xl border border-border/70 bg-surface-inset/80 px-3 py-3">
                      <p className="text-sm font-medium text-foreground">서비스 이용약관</p>
                      <p className="text-sm text-muted-foreground">
                        {member.service_policy_version ? `v${member.service_policy_version}` : "미동의"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(member.service_policy_consented_at)}
                      </p>
                    </div>
                    <div className="grid gap-1 rounded-2xl border border-border/70 bg-surface-inset/80 px-3 py-3">
                      <p className="text-sm font-medium text-foreground">개인정보 처리방침</p>
                      <p className="text-sm text-muted-foreground">
                        {member.privacy_policy_version ? `v${member.privacy_policy_version}` : "미동의"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(member.privacy_policy_consented_at)}
                      </p>
                    </div>
                    <div className="grid gap-1 rounded-2xl border border-border/70 bg-surface-inset/80 px-3 py-3">
                      <p className="text-sm font-medium text-foreground">마케팅 정보 수신</p>
                      <p className="text-sm text-muted-foreground">
                        {member.marketing_policy_version ? `v${member.marketing_policy_version}` : "미동의"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(member.marketing_policy_consented_at)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {consentHistory.map((consent, index) => (
                      <div
                        key={`${consent.kind}-${consent.version}-${consent.agreed_at}-${index}`}
                        className="grid gap-1 rounded-2xl border border-border/70 bg-surface-inset/80 px-3 py-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium text-foreground">
                            {getConsentLabel(consent.kind)}
                          </span>
                          <span className="text-muted-foreground">v{consent.version}</span>
                        </div>
                        <p className="text-muted-foreground">
                          동의 시각 {formatDateTime(consent.agreed_at)}
                        </p>
                        {consent.title ? (
                          <p className="text-muted-foreground">
                            문서 {consent.title}
                            {consent.effective_at
                              ? ` · 시행 ${formatDateTime(consent.effective_at)}`
                              : ""}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-3 rounded-2xl border border-border bg-surface-muted/40 px-4 py-4">
                <div className="grid gap-1">
                  <p className="text-sm font-semibold text-foreground">알림 설정</p>
                  <p className="text-sm text-muted-foreground">
                    회원별 채널/항목 수신 설정과 활성 푸시 기기 수입니다.
                  </p>
                </div>

                <div className="grid gap-4">
                  <div className="grid gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">채널 설정</p>
                      <p className="text-xs text-muted-foreground">
                        활성 기기 {(notificationPreferences?.activeDeviceCount ?? 0).toLocaleString()}대
                      </p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <NotificationPreferenceItem
                        label="푸시 채널"
                        enabled={notificationPreferences?.enabled ?? false}
                      />
                      <NotificationPreferenceItem
                        label="Mattermost"
                        enabled={notificationPreferences?.mmEnabled ?? false}
                      />
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-surface-inset/80 px-3 py-3">
                        <span className="text-sm font-medium text-foreground">활성 기기 수</span>
                        <span className="text-xs font-semibold text-foreground">
                          {(notificationPreferences?.activeDeviceCount ?? 0).toLocaleString()}대
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <p className="text-sm font-semibold text-foreground">알림 항목 설정</p>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <NotificationPreferenceItem
                        label="운영 공지"
                        enabled={notificationPreferences?.announcementEnabled ?? false}
                      />
                      <NotificationPreferenceItem
                        label="신규 제휴"
                        enabled={notificationPreferences?.newPartnerEnabled ?? false}
                      />
                      <NotificationPreferenceItem
                        label="종료 임박"
                        enabled={notificationPreferences?.expiringPartnerEnabled ?? false}
                      />
                      <NotificationPreferenceItem
                        label="리뷰"
                        enabled={notificationPreferences?.reviewEnabled ?? false}
                      />
                      <NotificationPreferenceItem
                        label="마케팅/이벤트"
                        enabled={notificationPreferences?.marketingEnabled ?? false}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <form id={updateFormId} action={updateAction} className="grid gap-3 rounded-2xl border border-border bg-surface-muted/40 px-4 py-4">
                <input type="hidden" name="id" value={member.id} />

                <div className="grid gap-1">
                  <p className="text-sm font-semibold text-foreground">회원 정보 수정</p>
                  <p className="text-sm text-muted-foreground">
                    표시명, 캠퍼스, 기수, 비밀번호 변경 강제를 수정할 수 있습니다.
                  </p>
                </div>

                <label className="grid gap-2 text-sm font-medium text-foreground">
                  표시 이름
                  <Input
                    name="displayName"
                    defaultValue={displayName}
                    placeholder="표시 이름"
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-foreground">
                  캠퍼스
                  <Input name="campus" defaultValue={campus} placeholder="서울" />
                </label>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium text-foreground">
                    기수
                    <Input
                      type="number"
                      min={0}
                      max={99}
                      name="year"
                      defaultValue={year}
                      placeholder={String(getCurrentSsafyYear())}
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-foreground">
                    비밀번호 변경 강제
                    <Select
                      name="mustChangePassword"
                      defaultValue={member.must_change_password ? "true" : "false"}
                    >
                      <option value="false">유지</option>
                      <option value="true">강제</option>
                    </Select>
                  </label>
                </div>
              </form>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <SubmitButton
                  form={updateFormId}
                  variant="ghost"
                  pendingText="저장 중"
                >
                  저장
                </SubmitButton>

                <form action={deleteAction} onSubmit={handleDeleteSubmit}>
                  <input type="hidden" name="id" value={member.id} />
                  <SubmitButton variant="danger" pendingText="삭제 중">
                    회원 삭제
                  </SubmitButton>
                </form>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
