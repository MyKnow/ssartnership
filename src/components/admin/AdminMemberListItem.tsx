"use client";

import { useMemo, useState } from "react";
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
import type {
  ActivePolicyVersions,
  AdminMember,
} from "@/components/admin/member-manager/selectors";

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

function getPolicyStatusTone(status: string) {
  switch (status) {
    case "현재 동의":
      return "text-emerald-600 dark:text-emerald-300";
    case "이전 버전 동의":
      return "text-amber-600 dark:text-amber-300";
    case "철회됨":
      return "text-rose-600 dark:text-rose-300";
    default:
      return "text-muted-foreground";
  }
}

function getPolicyStatusBadgeClass(status: string) {
  switch (status) {
    case "현재 동의":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200";
    case "이전 버전 동의":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200";
    case "철회됨":
      return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-200";
    default:
      return "border-border/70 bg-surface-inset/80 text-muted-foreground";
  }
}

function getPolicyStateLabel(
  kind: "service" | "privacy" | "marketing",
  latestVersion?: number | null,
  activeVersion?: number | null,
  hasHistory = false,
) {
  if (!latestVersion) {
    return "미동의";
  }

  if (kind === "marketing" && !hasHistory) {
    return activeVersion && latestVersion === activeVersion
      ? "현재 동의"
      : activeVersion
        ? "이전 버전 동의"
        : "동의";
  }

  if (activeVersion && latestVersion === activeVersion) {
    return "현재 동의";
  }

  if (activeVersion) {
    return "이전 버전 동의";
  }

  return "동의";
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
  activePolicyVersions,
  updateAction,
  deleteAction,
}: {
  member: AdminMember;
  activePolicyVersions: ActivePolicyVersions;
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
  const updateFormId = `member-update-${member.id}`;
  const notificationPreferences = member.notification_preferences;
  const avatarLabel = (displayName || member.mm_username || "?").trim().charAt(0).toUpperCase();
  const hasAvatar = Boolean(member.avatar_content_type);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const avatarUrl = useMemo(() => {
    if (member.avatar_content_type && member.avatar_base64) {
      return `data:${member.avatar_content_type};base64,${member.avatar_base64}`;
    }

    const params = new URLSearchParams();
    if (member.updated_at) {
      params.set("v", member.updated_at);
    }

    const query = params.toString();
    return `/api/admin/members/${member.id}/avatar${query ? `?${query}` : ""}`;
  }, [member.avatar_base64, member.avatar_content_type, member.id, member.updated_at]);

  const policyStateCards = useMemo(() => {
    const policyKinds = ["service", "privacy", "marketing"] as const;
    const historyByKind = new Map<
      (typeof policyKinds)[number],
      Array<{
        agreed: boolean;
        at: string;
        version?: number | null;
        title?: string | null;
        effective_at?: string | null;
      }>
    >();

    for (const kind of policyKinds) {
      historyByKind.set(kind, []);
    }

    for (const consent of member.consent_history ?? []) {
      historyByKind.get(consent.kind)?.push({
        agreed: true,
        at: consent.agreed_at,
        version: consent.version,
        title: consent.title ?? null,
        effective_at: consent.effective_at ?? null,
      });
    }

    for (const activity of member.consent_activity ?? []) {
      historyByKind.get(activity.kind)?.push({
        agreed: activity.agreed,
        at: activity.at,
        version: activity.version ?? null,
        title: activity.title ?? null,
        effective_at: activity.effective_at ?? null,
      });
    }

    const latestByKind = new Map<
      (typeof policyKinds)[number],
      {
        agreed: boolean;
        at: string;
        version?: number | null;
        title?: string | null;
        effective_at?: string | null;
      } | null
    >();

    for (const kind of policyKinds) {
      const latest = [...(historyByKind.get(kind) ?? [])].sort(
        (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
      )[0] ?? null;
      latestByKind.set(kind, latest);
    }

    return policyKinds.map((kind) => {
      const latest = latestByKind.get(kind) ?? null;
      const activeVersion = activePolicyVersions[kind];
      const historyEntries = historyByKind.get(kind) ?? [];
      const hasHistory = historyEntries.length > 0;
      const latestAgreement =
        [...historyEntries].filter((item) => item.agreed).sort(
          (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
        )[0] ?? null;
      const version = latest?.version ?? latestAgreement?.version ?? null;
      const latestAt = latest?.at ?? null;
      const agreedAt = latest?.agreed
        ? latestAt
        : kind === "marketing" && hasHistory
          ? latestAt ?? member.marketing_policy_consented_at ?? null
          : latestAt;

      let statusLabel = "미동의";
      let timestampLabel = "동의 시각";
      let timestampValue = "-";

      if (latest) {
        if (kind === "marketing") {
          if (latest.agreed) {
            statusLabel = getPolicyStateLabel(kind, version, activeVersion, hasHistory);
            timestampLabel = "동의 시각";
            timestampValue = formatDateTime(agreedAt);
          } else if (hasHistory) {
            statusLabel = "철회됨";
            timestampLabel = "철회 시각";
            timestampValue = formatDateTime(latest.at);
          } else {
            statusLabel = "미동의";
            timestampLabel = "확인 시각";
            timestampValue = "-";
          }
        } else {
          statusLabel = getPolicyStateLabel(kind, version, activeVersion, hasHistory);
          timestampLabel = "동의 시각";
          timestampValue = formatDateTime(agreedAt ?? latest.at);
        }
      } else if (kind === "marketing") {
        const currentVersion = member.marketing_policy_version ?? null;
        const currentAt = member.marketing_policy_consented_at ?? null;
        if (currentVersion) {
          statusLabel = getPolicyStateLabel(kind, currentVersion, activeVersion, hasHistory);
          timestampLabel = "동의 시각";
          timestampValue = formatDateTime(currentAt);
        } else {
          statusLabel = "미동의";
          timestampLabel = "확인 시각";
          timestampValue = "-";
        }
      } else {
        const currentVersion =
          kind === "service"
            ? member.service_policy_version ?? null
            : member.privacy_policy_version ?? null;
        const currentAt =
          kind === "service"
            ? member.service_policy_consented_at ?? null
            : member.privacy_policy_consented_at ?? null;
        if (currentVersion) {
          statusLabel = getPolicyStateLabel(kind, currentVersion, activeVersion, hasHistory);
          timestampLabel = "동의 시각";
          timestampValue = formatDateTime(currentAt);
        } else {
          statusLabel = "미동의";
          timestampLabel = "확인 시각";
          timestampValue = "-";
        }
      }

      return {
        kind,
        label: getConsentLabel(kind),
        statusLabel,
        statusClass: getPolicyStatusBadgeClass(statusLabel),
        timestampLabel,
        timestampValue,
        versionLabel: version ? `버전 v${version}` : null,
      };
    });
  }, [
    activePolicyVersions,
    member.consent_activity,
    member.consent_history,
    member.marketing_policy_consented_at,
    member.marketing_policy_version,
    member.privacy_policy_consented_at,
    member.privacy_policy_version,
    member.service_policy_consented_at,
    member.service_policy_version,
  ]);

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
        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface-muted text-lg font-semibold text-foreground">
          {hasAvatar && !avatarFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <span aria-hidden="true">{avatarLabel || "?"}</span>
          )}
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
                  <p className="text-sm font-semibold text-foreground">약관 상태</p>
                  <p className="text-sm text-muted-foreground">
                    각 약관의 현재 상태와 마지막 동의 또는 철회 시각을 보여줍니다.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {policyStateCards.map((item) => (
                    <div
                      key={item.kind}
                      className="grid gap-2 rounded-2xl border border-border/70 bg-surface-inset/80 px-3 py-3 text-sm shadow-raised"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-foreground">{item.label}</p>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${item.statusClass}`}
                        >
                          {item.statusLabel}
                        </span>
                      </div>
                      <p className={`text-xs font-medium ${getPolicyStatusTone(item.statusLabel)}`}>
                        {item.timestampLabel} {item.timestampValue}
                      </p>
                      {item.versionLabel ? (
                        <p className="text-xs text-muted-foreground">{item.versionLabel}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
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
