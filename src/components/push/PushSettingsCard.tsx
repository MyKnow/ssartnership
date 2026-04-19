"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import IconActionButton, { IconActionGroup } from "@/components/ui/IconActionButton";
import { getPolicyHref } from "@/lib/policy-documents";
import { formatKoreanDateTime } from "@/lib/datetime";
import { getPushSettingsStatusClassName } from "./push-settings/status";
import { InstallGuideStep } from "./push-settings/InstallGuideStep";
import { PreferenceToggle } from "./push-settings/PreferenceToggle";
import { usePushSettingsController } from "./push-settings/usePushSettingsController";
import type { PreferenceKey, PushSettingsCardProps } from "./push-settings/types";

type ItemPreferenceKey = Exclude<PreferenceKey, "mmEnabled">;

const preferenceLabels: Record<ItemPreferenceKey, string> = {
  announcementEnabled: "운영 공지",
  newPartnerEnabled: "새 제휴",
  expiringPartnerEnabled: "종료 임박",
  reviewEnabled: "리뷰",
  marketingEnabled: "마케팅/이벤트",
};

function formatDeviceDate(value: string | null) {
  if (!value) {
    return "최근 기록 없음";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "최근 기록 없음";
  }
  return formatKoreanDateTime(date, {
    month: "short",
    day: "numeric",
  });
}

function IOSInstallGuide({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">iPhone/iPad 설정</p>
        <p className="text-sm text-muted-foreground">
          아래 순서대로 한 번만 설정하면 됩니다.
        </p>
      </div>
      <div className="mt-4 grid gap-4">
        <InstallGuideStep
          step="1"
          title="브라우저의 공유 버튼을 누르세요."
          description="페이지 안 버튼이 아니라 브라우저 기본 공유 버튼을 사용합니다."
        />
        <InstallGuideStep
          step="2"
          title="홈 화면에 추가를 선택하세요."
          description="홈 화면에 SSARTNERSHIP 아이콘이 생깁니다."
        />
        <InstallGuideStep
          step="3"
          title="설치된 앱을 열고 이 화면에서 알림을 켜세요."
          description="설치형 앱 안에서만 알림 권한을 요청할 수 있습니다."
        />
      </div>
    </div>
  );
}

export type { PreferenceKey, PushSettingsCardProps } from "./push-settings/types";
export { derivePushSettingsStatus, getPushSettingsStatusClassName } from "./push-settings/status";

export default function PushSettingsCard(props: PushSettingsCardProps) {
  const controller = usePushSettingsController(props);
  const marketingPolicyHref = props.marketingPolicy
    ? getPolicyHref(props.marketingPolicy.kind, props.marketingPolicy.version)
    : "/legal/marketing";

  return (
    <Card
      tone="default"
      className="mx-auto max-w-3xl min-w-0 overflow-hidden"
      padding="md"
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-4">
          <div className="min-w-0 space-y-1">
            <h2 className="text-lg font-semibold text-foreground">알림 설정</h2>
            <p className="text-sm text-muted-foreground">받을 항목과 기기 상태를 관리합니다.</p>
          </div>
          {controller.status && !controller.iosNeedsInstall ? (
            <Badge className={getPushSettingsStatusClassName(controller.status)}>
              {controller.status.label}
            </Badge>
          ) : null}
        </div>

        {controller.iosNeedsInstall ? (
          <IOSInstallGuide className="hidden rounded-2xl border border-border/70 bg-surface-inset px-4 py-4 sm:block" />
        ) : null}

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">알림 채널</h3>
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface-inset px-4 py-3">
              <span className="text-sm font-medium text-foreground">인 앱</span>
              <span
                aria-hidden="true"
                className="relative inline-flex items-center opacity-65 saturate-75"
              >
                <span className="h-7 w-12 rounded-full border border-emerald-500/70 bg-emerald-500/80 dark:border-emerald-400/70 dark:bg-emerald-400/80" />
                <span className="pointer-events-none absolute left-1 h-5 w-5 translate-x-5 rounded-full bg-white shadow dark:bg-slate-950" />
              </span>
            </div>
            <PreferenceToggle
              id="push-pref-mm"
              label="Mattermost"
              checked={controller.preferences.mmEnabled}
              disabled={controller.hasPendingAction}
              onChange={(next) => {
                void controller.updateChannelPreference("mmEnabled", next);
              }}
            />
            <div className="space-y-3 rounded-2xl border border-border bg-surface-inset px-4 py-3">
              <label className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-foreground">푸시</span>
                <span className="flex items-center gap-3">
                  <span
                    className={controller.preferences.enabled
                      ? "min-w-10 text-right text-xs font-semibold text-emerald-600 dark:text-emerald-300"
                      : "min-w-10 text-right text-xs font-semibold text-muted-foreground"}
                  >
                    {controller.preferences.enabled ? "켜짐" : "꺼짐"}
                  </span>
                  <span className="relative inline-flex items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={controller.preferences.enabled}
                      disabled={controller.hasPendingAction}
                      onChange={(event) => {
                        void controller.updateChannelPreference(
                          "enabled",
                          event.target.checked,
                        );
                      }}
                    />
                    <span className="h-7 w-12 rounded-full border border-border bg-slate-300 transition peer-checked:border-emerald-500 peer-checked:bg-emerald-500 peer-disabled:opacity-50 dark:bg-slate-700 dark:peer-checked:border-emerald-400 dark:peer-checked:bg-emerald-400" />
                    <span className="pointer-events-none absolute left-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5 peer-disabled:opacity-70 dark:bg-slate-950" />
                  </span>
                </span>
              </label>
              {controller.preferences.enabled ? (
                <div className="grid gap-2 border-t border-border/70 pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {controller.devices.length > 0
                        ? `${controller.devices.length}개 기기에서 푸시 수신 중`
                        : "푸시 수신 기기 없음"}
                    </span>
                    {controller.canControlPush && !controller.deviceEnabled ? (
                      <Button
                        className="w-auto justify-center"
                        size="sm"
                        onClick={controller.handleSubscribe}
                        loading={
                          controller.loading ||
                          controller.pendingAction === "subscribe"
                        }
                        loadingText="연결 중"
                        disabled={
                          controller.hasPendingAction &&
                          controller.pendingAction !== "subscribe"
                        }
                      >
                        이 기기에서 받기
                      </Button>
                    ) : null}
                  </div>
                  {controller.devices.length > 0 ? (
                    <div className="divide-y divide-border/60 rounded-[1.15rem] border border-border/70 bg-surface-inset/70">
                      {controller.devices.map((device) => (
                        <div
                          key={device.id}
                          className="relative px-3 py-2.5 pr-12"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-foreground">
                                {device.label}
                              </span>
                              {device.isCurrent ? (
                                <Badge
                                  className="shadow-[var(--shadow-flat)]"
                                  style={{
                                    backgroundColor: "#213b68",
                                    borderColor: "#213b68",
                                    color: "#ffffff",
                                  }}
                                >
                                  현재 기기
                                </Badge>
                              ) : null}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              최근 갱신 {formatDeviceDate(device.updatedAt)}
                            </p>
                          </div>
                          <IconActionGroup className="absolute right-3 top-1/2 -translate-y-1/2">
                            <IconActionButton
                              tone="danger"
                              onClick={() => {
                                void controller.handleDisconnectDevice(device.id);
                              }}
                              disabled={
                                controller.hasPendingAction &&
                                controller.pendingAction !== "device-off"
                              }
                              aria-label={`${device.label} 연결 해제`}
                              title="연결 해제"
                            >
                              <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                            </IconActionButton>
                          </IconActionGroup>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border bg-surface-inset/75 px-3 py-3">
                      <p className="text-sm text-muted-foreground">
                        아직 푸시를 받을 기기가 없습니다.
                      </p>
                    </div>
                  )}
                </div>
              ) : controller.canControlPush ? (
                <div className="flex justify-end border-t border-border/70 pt-3">
                  <Button
                    className="w-full justify-center sm:w-auto"
                    onClick={controller.handleSubscribe}
                    loading={
                      controller.loading ||
                      controller.pendingAction === "subscribe"
                    }
                    loadingText={
                      controller.loading ? "상태 확인 중" : "이 기기 켜는 중"
                    }
                    disabled={
                      controller.hasPendingAction &&
                      controller.pendingAction !== "subscribe"
                    }
                  >
                    이 기기에서 푸시 받기
                  </Button>
                </div>
              ) : null}
              {controller.iosNeedsInstall ? (
                <IOSInstallGuide className="border-t border-border/70 pt-4 sm:hidden" />
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">받을 항목</h3>
          <div className="grid gap-3">
            {(Object.keys(preferenceLabels) as ItemPreferenceKey[]).map((key) => (
              <PreferenceToggle
                key={key}
                id={`push-pref-${key}`}
                label={preferenceLabels[key]}
                checked={controller.preferences[key]}
                disabled={controller.hasPendingAction}
                onChange={(next) => {
                  void controller.updatePreference(key, next);
                }}
                actionHref={key === "marketingEnabled" ? marketingPolicyHref : undefined}
              />
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
