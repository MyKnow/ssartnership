"use client";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import InlineMessage from "@/components/ui/InlineMessage";
import { getPushSettingsStatusClassName } from "./push-settings/status";
import { InstallGuideStep } from "./push-settings/InstallGuideStep";
import { PreferenceToggle } from "./push-settings/PreferenceToggle";
import { usePushSettingsController } from "./push-settings/usePushSettingsController";
import type { PreferenceKey, PushSettingsCardProps } from "./push-settings/types";

const preferenceLabels: Record<PreferenceKey, string> = {
  announcementEnabled: "운영 공지",
  newPartnerEnabled: "신규 제휴",
  expiringPartnerEnabled: "종료 7일 전",
};

export type { PreferenceKey, PushSettingsCardProps } from "./push-settings/types";
export { derivePushSettingsStatus, getPushSettingsStatusClassName } from "./push-settings/status";

export default function PushSettingsCard(props: PushSettingsCardProps) {
  const controller = usePushSettingsController(props);
  const summary =
    !props.configured
      ? "알림 기능을 준비 중입니다. 잠시 후 다시 확인해 주세요."
      : !controller.supported
        ? "현재 브라우저에서는 알림을 받을 수 없습니다."
        : controller.iosNeedsInstall
          ? "iPhone/iPad에서는 홈 화면에 추가한 뒤 알림을 켤 수 있습니다."
          : controller.isReceivingOnThisDevice
            ? "이 기기에서 새 제휴와 운영 공지를 받고 있습니다."
            : controller.accountEnabled
              ? "다른 기기에서는 받고 있지만, 이 기기에서는 아직 꺼져 있습니다."
              : "이 기기에서는 아직 알림을 받고 있지 않습니다.";

  const noticeTone =
    !props.configured || controller.permission === "denied" || controller.iosNeedsInstall
      ? "warning"
      : "info";
  const noticeTitle =
    !props.configured
      ? "알림 준비 중"
      : !controller.supported
        ? "이 브라우저에서는 알림을 받을 수 없어요"
        : controller.iosNeedsInstall
          ? "먼저 홈 화면에 추가해 주세요"
          : controller.permission === "denied"
            ? "브라우저 알림 권한을 다시 허용해 주세요"
            : controller.accountEnabled
              ? "다른 기기에서는 이미 알림을 받고 있어요"
              : "원할 때만 알림을 켜면 됩니다";
  const noticeDescription =
    !props.configured
      ? "서버 준비가 끝나면 바로 사용할 수 있습니다."
      : !controller.supported
        ? "Chrome, Edge 또는 iPhone/iPad 설치형 앱에서 확인해 주세요."
        : controller.iosNeedsInstall
          ? "설치된 앱 안에서만 알림 권한을 요청할 수 있습니다."
          : controller.permission === "denied"
            ? "브라우저 설정에서 알림을 다시 허용한 뒤 이 화면으로 돌아와 주세요."
            : controller.accountEnabled
              ? "필요하면 이 기기에서도 알림을 켜 두세요."
              : "새 제휴, 종료 임박, 운영 공지만 간단히 받아볼 수 있습니다.";

  return (
    <Card tone="default" className="mx-auto mt-4 max-w-2xl min-w-0 overflow-hidden">
      <div className="space-y-3 border-b border-border/70 pb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 className="text-lg font-semibold text-foreground">기기 알림</h2>
            <p className="text-sm text-muted-foreground">{summary}</p>
          </div>
          {!controller.iosNeedsInstall ? (
            <Badge className={getPushSettingsStatusClassName(controller.status)}>
              {controller.status.label}
            </Badge>
          ) : null}
        </div>
      </div>

      {!controller.isReceivingOnThisDevice ? (
        <InlineMessage
          className="mt-5"
          tone={noticeTone}
          title={noticeTitle}
          description={noticeDescription}
        />
      ) : null}

      {controller.iosNeedsInstall ? (
        <div className="mt-5 rounded-2xl border border-border/70 bg-surface px-4 py-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">iPhone/iPad 설정 방법</p>
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
      ) : null}

      {controller.canControlPush ? (
        <div className="mt-5 rounded-2xl border border-border/70 bg-surface px-4 py-4">
          <div className="flex flex-col gap-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">알림 켜기 또는 끄기</p>
              <p className="text-sm text-muted-foreground">
                {controller.isReceivingOnThisDevice
                  ? "이 기기에서 제휴 알림을 받고 있습니다."
                  : controller.accountEnabled
                    ? "이 기기에서는 알림이 꺼져 있지만, 다른 기기에서는 수신 중일 수 있습니다."
                    : "모든 기기에서 제휴 알림이 꺼져 있습니다."}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button
                className="w-full justify-center sm:w-auto"
                onClick={
                  controller.deviceEnabled
                    ? controller.handleUnsubscribeDevice
                    : controller.handleSubscribe
                }
                loading={
                  controller.loading ||
                  controller.pendingAction === "subscribe" ||
                  controller.pendingAction === "device-off"
                }
                loadingText={
                  controller.loading
                    ? "상태 확인 중"
                    : controller.deviceEnabled
                      ? "이 기기 끄는 중"
                      : "이 기기 켜는 중"
                }
                disabled={
                  controller.hasPendingAction &&
                  controller.pendingAction !== "subscribe" &&
                  controller.pendingAction !== "device-off"
                }
              >
                {controller.deviceEnabled ? "이 기기 알림 끄기" : "이 기기 알림 켜기"}
              </Button>
              {controller.accountEnabled ? (
                <Button
                  variant="danger"
                  className="w-full justify-center sm:w-auto"
                  onClick={controller.handleUnsubscribeAll}
                  loading={controller.pendingAction === "all-off"}
                  loadingText="전체 끄는 중"
                  disabled={
                    controller.hasPendingAction &&
                    controller.pendingAction !== "all-off"
                  }
                >
                  내 모든 기기에서 끄기
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {controller.canControlPush && controller.accountEnabled ? (
        <div className="mt-6">
          <div className="mb-3 space-y-1">
            <h3 className="text-sm font-semibold text-foreground">받을 알림</h3>
            <p className="text-sm text-muted-foreground">
              필요한 항목만 남겨 두세요.
            </p>
          </div>
          <div className="grid gap-3">
            {(Object.keys(preferenceLabels) as PreferenceKey[]).map((key) => (
              <PreferenceToggle
                key={key}
                label={preferenceLabels[key]}
                checked={controller.preferences[key]}
                disabled={controller.hasPendingAction}
                onChange={(next) => {
                  void controller.updatePreference(key, next);
                }}
              />
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
