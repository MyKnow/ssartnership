import AdminSectionHeading from "@/components/admin/AdminSectionHeading";
import Badge from "@/components/ui/Badge";
import Surface from "@/components/ui/Surface";
import type {
  AdminMemberNotificationPreferences,
  AdminMemberPolicyEvent,
  AdminMemberPolicyState,
} from "@/lib/admin-member-detail";
import { formatKoreanDateTimeToMinute } from "@/lib/datetime";

function formatDate(value: string | null) {
  return value ? formatKoreanDateTimeToMinute(value) : "-";
}

function PreferenceItem({
  label,
  enabled,
}: {
  label: string;
  enabled: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-border/70 bg-surface-inset px-3 py-3">
      <span className="min-w-0 text-sm font-medium text-foreground">{label}</span>
      <Badge variant={enabled ? "success" : "neutral"}>
        {enabled ? "켜짐" : "꺼짐"}
      </Badge>
    </div>
  );
}

function policyBadgeClass(status: AdminMemberPolicyState["status"]) {
  switch (status) {
    case "current":
    case "agreed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200";
    case "outdated":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200";
    case "revoked":
      return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-200";
    case "notAgreed":
      return "border-border bg-surface-muted text-muted-foreground";
  }
}

function eventLabel(event: AdminMemberPolicyEvent) {
  const kindLabel =
    event.kind === "service"
      ? "서비스 이용약관"
      : event.kind === "privacy"
        ? "개인정보 처리방침"
        : "마케팅 정보 수신";
  return `${kindLabel} ${event.agreed ? "동의" : "철회"}`;
}

export default function AdminMemberCommunicationPanel({
  preferences,
  policyStates,
  consentTimeline,
}: {
  preferences: AdminMemberNotificationPreferences;
  policyStates: readonly AdminMemberPolicyState[];
  consentTimeline: readonly AdminMemberPolicyEvent[];
}) {
  const timeline = consentTimeline.slice(0, 12);

  return (
    <Surface level="elevated" padding="lg" className="grid min-w-0 gap-6">
      <AdminSectionHeading
        title="알림·약관 상태"
        description="수신 설정과 활성 푸시 기기, 현재 약관 상태와 최근 동의 활동을 확인합니다."
      />

      <div className="grid min-w-0 gap-6 2xl:grid-cols-2">
        <section className="grid min-w-0 content-start gap-4" aria-labelledby="member-notification-preferences">
          <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h3 id="member-notification-preferences" className="text-lg font-semibold text-foreground">
                알림 설정
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                회원이 선택한 채널과 알림 항목입니다.
              </p>
            </div>
            <Badge variant={preferences.activeDeviceCount > 0 ? "success" : "neutral"}>
              활성 기기 {preferences.activeDeviceCount.toLocaleString("ko-KR")}대
            </Badge>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <PreferenceItem label="푸시 채널" enabled={preferences.enabled} />
            <PreferenceItem label="Mattermost" enabled={preferences.mmEnabled} />
            <PreferenceItem label="운영 공지" enabled={preferences.announcementEnabled} />
            <PreferenceItem label="신규 제휴" enabled={preferences.newPartnerEnabled} />
            <PreferenceItem label="종료 임박" enabled={preferences.expiringPartnerEnabled} />
            <PreferenceItem label="리뷰" enabled={preferences.reviewEnabled} />
            <PreferenceItem label="마케팅/이벤트" enabled={preferences.marketingEnabled} />
          </div>
        </section>

        <section className="grid min-w-0 content-start gap-4" aria-labelledby="member-policy-status">
          <div>
            <h3 id="member-policy-status" className="text-lg font-semibold text-foreground">
              약관 상태
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              활성 정책 버전과 마지막 동의 또는 철회 시각을 비교합니다.
            </p>
          </div>

          <div className="grid min-w-0 gap-3">
            {policyStates.map((state) => (
              <div
                key={state.kind}
                className="grid min-w-0 gap-2 rounded-2xl border border-border/70 bg-surface-inset px-4 py-3"
              >
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                  <p className="font-medium text-foreground">{state.label}</p>
                  <Badge className={policyBadgeClass(state.status)}>
                    {state.statusLabel}
                  </Badge>
                </div>
                <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{state.version ? `버전 v${state.version}` : "버전 없음"}</span>
                  <span>
                    {state.eventLabel} {formatDate(state.eventAt)}
                  </span>
                </div>
                {state.title ? (
                  <p className="text-ko-pretty text-sm text-muted-foreground">
                    {state.title}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="grid min-w-0 gap-3 border-t border-border/70 pt-5" aria-labelledby="member-consent-timeline">
        <div>
          <h3 id="member-consent-timeline" className="text-lg font-semibold text-foreground">
            최근 동의 활동
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            정책 동의 기록과 보안 활동을 최신순으로 합쳐 최대 12건 표시합니다.
          </p>
        </div>
        {timeline.length > 0 ? (
          <ol className="grid min-w-0 gap-2">
            {timeline.map((event, index) => (
              <li
                key={`${event.kind}-${event.agreed}-${event.version ?? "none"}-${event.at}-${index}`}
                className="grid min-w-0 gap-1 rounded-2xl border border-border/70 bg-surface-inset px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {eventLabel(event)}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {event.title ?? (event.version ? `정책 버전 v${event.version}` : "버전 정보 없음")}
                  </p>
                </div>
                <time dateTime={event.at} className="text-xs text-muted-foreground">
                  {formatDate(event.at)}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-2xl border border-dashed border-border bg-surface-inset px-4 py-5 text-sm text-muted-foreground">
            저장된 동의 활동이 없습니다.
          </p>
        )}
      </section>
    </Surface>
  );
}
