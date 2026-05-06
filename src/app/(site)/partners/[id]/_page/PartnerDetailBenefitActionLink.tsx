"use client";

import { ExternalLink, Mail, Phone } from "lucide-react";

import { trackProductEvent } from "@/lib/product-events";

function getBenefitActionCopy(href: string) {
  if (href.startsWith("tel:")) {
    return {
      title: "전화로 혜택 이용하기",
      description: "통화 앱으로 연결해 혜택 이용 방법을 확인합니다.",
      Icon: Phone,
    };
  }

  if (href.startsWith("mailto:")) {
    return {
      title: "이메일로 혜택 문의하기",
      description: "메일 앱으로 연결해 혜택 이용 방법을 확인합니다.",
      Icon: Mail,
    };
  }

  return {
    title: "외부 페이지에서 이용하기",
    description: "예약, 신청 또는 쿠폰 확인 페이지로 이동합니다.",
    Icon: ExternalLink,
  };
}

export default function PartnerDetailBenefitActionLink({
  href,
  partnerId,
}: {
  href: string;
  partnerId: string;
}) {
  const { title, description, Icon } = getBenefitActionCopy(href);
  const isHttpLink = href.startsWith("http");

  return (
    <a
      href={href}
      className="group mt-4 flex items-center gap-3 rounded-2xl border border-border bg-surface-muted px-4 py-3 text-left transition-interactive duration-200 hover:-translate-y-px hover:border-strong hover:bg-surface-control hover:shadow-flat focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      target={isHttpLink ? "_blank" : undefined}
      rel={isHttpLink ? "noopener noreferrer" : undefined}
      onClick={() => {
        trackProductEvent({
          eventName: "reservation_click",
          targetType: "partner",
          targetId: partnerId,
          properties: {
            source: "detail",
          },
        });
      }}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-sm font-semibold text-foreground">
          {title}
        </span>
        <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface-elevated text-foreground shadow-flat transition-interactive duration-200 group-hover:border-strong group-hover:text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
    </a>
  );
}
