"use client";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import InlineMessage from "@/components/ui/InlineMessage";
import StatsRow from "@/components/ui/StatsRow";
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

  return (
    <Card tone="elevated" className="mx-auto mt-6 max-w-2xl min-w-0 overflow-hidden">
      <div className="border-b border-border pb-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 text-lg font-semibold text-foreground">
            푸시 알림 설정
          </h2>
          <Badge className={getPushSettingsStatusClassName(controller.status)}>
            {controller.status.label}
          </Badge>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          새 제휴 등록, 종료 7일 전 안내, 운영 공지를 이 기기의 앱 알림으로
          받아볼 수 있습니다.
        </p>
      </div>

      <div className="mt-5">
        <StatsRow
          minItemWidth="11rem"
          items={[
            {
              label: "권한 상태",
              value:
                controller.permission === "unsupported"
                  ? "미지원"
                  : controller.permission,
              hint: "브라우저 알림 권한 상태",
            },
            {
              label: "기기 구독",
              value: controller.hasSubscription ? "구독됨" : "미구독",
              hint: "현재 기기의 Web Push 연결 상태",
            },
          ]}
        />
      </div>

      {!controller.isReceivingOnThisDevice ? (
        <InlineMessage
          className="mt-5"
          tone={
            !props.configured ||
            controller.iosNeedsInstall ||
            controller.permission === "denied"
              ? "warning"
              : "info"
          }
          title="현재 기기에서는 아직 알림이 완전히 켜져 있지 않습니다."
          description={
            !props.configured
              ? "서버에 VAPID 키와 CRON 시크릿이 설정되면 알림 기능을 바로 사용할 수 있습니다."
              : !controller.supported
                ? "이 브라우저는 Web Push를 지원하지 않습니다. 최신 Chrome, Edge 또는 iOS/iPadOS 설치형 앱에서 확인해 주세요."
                : controller.iosNeedsInstall
                  ? "iPhone/iPad에서는 브라우저의 공유 메뉴에서 홈 화면에 추가한 뒤, 설치된 앱 안에서 알림을 켤 수 있습니다."
                  : controller.permission === "denied"
                    ? "브라우저 설정에서 알림 권한을 다시 허용한 뒤 재시도해 주세요."
                    : controller.accountEnabled
                      ? "이 계정은 다른 기기에서 알림을 받고 있습니다. 현재 기기에서도 필요하면 알림을 켜 주세요."
                      : "기기 알림을 켜면 공지와 제휴 소식을 앱처럼 받을 수 있습니다."
          }
        />
      ) : null}

      {controller.iosNeedsInstall ? (
        <div className="mt-5 rounded-2xl border border-border bg-surface px-4 py-4">
          <div>
            <p className="text-sm font-semibold text-foreground">
              iPhone/iPad에서 알림 켜는 방법
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              일반 브라우저 탭에서는 알림을 바로 켤 수 없습니다. 아래 순서대로
              설치한 뒤 다시 시도해 주세요.
            </p>
          </div>
          <div className="mt-4 grid gap-4">
            <InstallGuideStep
              step="1"
              title="현재 브라우저의 기본 공유 버튼을 누르세요."
              description="페이지 안 버튼이 아니라, 브라우저 자체의 상단 또는 하단 공유 버튼을 사용해야 합니다."
            />
            <InstallGuideStep
              step="2"
              title="홈 화면에 추가를 선택하세요."
              description="아이폰이나 아이패드 홈 화면에 SSARTNERSHIP 앱 아이콘이 생성됩니다."
            />
            <InstallGuideStep
              step="3"
              title="설치된 앱을 열고 이 화면에서 알림 켜기를 누르세요."
              description="설치형 앱 상태에서만 iOS/iPadOS Web Push 권한 요청이 가능합니다."
            />
          </div>
        </div>
      ) : null}

      {controller.canControlPush ? (
        <div className="mt-5 rounded-2xl border border-border bg-surface px-4 py-4">
          <div className="flex flex-col gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">기기 알림 제어</p>
              <p className="mt-1 text-sm text-muted-foreground">
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
                  모든 기기에서 알림 끄기
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {controller.canControlPush && controller.accountEnabled ? (
        <div className="mt-6">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-foreground">세부 알림 항목</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              받고 싶은 알림만 개별적으로 켜고 끌 수 있습니다.
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
