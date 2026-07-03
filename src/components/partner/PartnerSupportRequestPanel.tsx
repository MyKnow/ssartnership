"use client";

import { useMemo, useState } from "react";
import SupportTemplateCard from "@/components/support/SupportTemplateCard";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import {
  buildSupportMailTemplate,
  type SupportMailTemplate,
} from "@/lib/support-mail";

type SupportRequestType =
  | "service"
  | "account"
  | "notification"
  | "plan"
  | "bug";

type PartnerSupportRequestPanelProps = {
  to: string;
  siteName: string;
  companyName: string;
  brandNames: string;
  displayName: string;
  loginId: string;
  currentUrl: string;
};

const supportTypeOptions: Array<{
  value: SupportRequestType;
  label: string;
  badge: string;
  subject: string;
  requestLine: string;
}> = [
  {
    value: "service",
    label: "브랜드 정보",
    badge: "정보 수정",
    subject: "브랜드 정보 지원 요청",
    requestLine: "6. 필요한 지원 내용: 브랜드 정보 수정/노출 상태 확인",
  },
  {
    value: "account",
    label: "계정/로그인",
    badge: "계정",
    subject: "계정 접근 지원 요청",
    requestLine: "6. 필요한 지원 내용: 로그인, 비밀번호, 계정 연결 문제",
  },
  {
    value: "notification",
    label: "알림 수신",
    badge: "알림",
    subject: "알림 수신 지원 요청",
    requestLine: "6. 필요한 지원 내용: 웹푸시, 이메일, 알림센터 수신 문제",
  },
  {
    value: "plan",
    label: "플랜/결제",
    badge: "플랜",
    subject: "플랜/결제 지원 요청",
    requestLine: "6. 필요한 지원 내용: 업그레이드 요청, 결제 확인, 플랜 기간 문의",
  },
  {
    value: "bug",
    label: "오류 제보",
    badge: "오류",
    subject: "포털 오류 제보",
    requestLine: "6. 필요한 지원 내용: 오류 상황, 재현 방법, 기대 동작",
  },
];

function buildTemplate(
  props: PartnerSupportRequestPanelProps,
  option: (typeof supportTypeOptions)[number],
): SupportMailTemplate {
  return buildSupportMailTemplate({
    to: props.to,
    subject: `[${props.siteName} 협력사 포털] ${props.companyName} ${option.subject}`,
    bodyLines: [
      `1. 업체명 / 브랜드명: ${props.companyName} / ${props.brandNames}`,
      `2. 담당자명: ${props.displayName}`,
      `3. 로그인 이메일: ${props.loginId}`,
      "4. 연락 가능한 전화번호:",
      `5. 문제가 발생한 화면 URL: ${props.currentUrl}`,
      option.requestLine,
    ],
  });
}

export default function PartnerSupportRequestPanel(
  props: PartnerSupportRequestPanelProps,
) {
  const [selectedType, setSelectedType] = useState<SupportRequestType>("service");
  const selectedOption =
    supportTypeOptions.find((option) => option.value === selectedType) ??
    supportTypeOptions[0];
  const template = useMemo(
    () => buildTemplate(props, selectedOption),
    [props, selectedOption],
  );

  return (
    <div className="grid gap-6">
      <Card tone="default" padding="md" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="ui-kicker">Support Type</p>
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">
              문의 유형 선택
            </h2>
            <p className="text-sm text-muted-foreground">
              유형을 고르면 제목과 6번 항목이 자동으로 바뀝니다.
            </p>
          </div>
          <Badge variant="primary">{selectedOption.badge}</Badge>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {supportTypeOptions.map((option) => {
            const active = option.value === selectedType;
            return (
              <Button
                key={option.value}
                type="button"
                variant={active ? "soft" : "secondary"}
                size="sm"
                ariaPressed={active}
                onClick={() => setSelectedType(option.value)}
                className={cn(
                  "justify-start",
                  active ? null : "text-muted-foreground",
                )}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
      </Card>

      <SupportTemplateCard
        template={template}
        description="메일 앱이 열리지 않으면 템플릿을 복사해 사용 중인 메일 서비스에 붙여넣어 보내 주세요."
      />
    </div>
  );
}
