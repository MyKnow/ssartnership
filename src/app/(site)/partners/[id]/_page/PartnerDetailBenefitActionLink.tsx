"use client";

import { ExternalLink, Mail, Phone } from "lucide-react";

import { cn } from "@/lib/cn";
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
  compact = false,
}: {
  href: string;
  partnerId: string;
  compact?: boolean;
}) {
  const { title, description, Icon } = getBenefitActionCopy(href);
  const isHttpLink = href.startsWith("http");

  return (
    <a
      href={href}
      className={cn(
        "group flex items-center gap-3 border text-left transition-interactive duration-200 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        compact
          ? "mt-0 min-h-[3.375rem] rounded-[1rem] border-transparent bg-primary px-4 py-2 text-primary-foreground shadow-raised hover:bg-primary-emphasis hover-shadow-floating"
          : "mt-4 rounded-2xl border-border bg-surface-muted px-4 py-3 hover:border-strong hover:bg-surface-control hover:shadow-flat",
      )}
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
        <span
          className={cn(
            "truncate text-sm font-semibold",
            compact ? "text-primary-foreground" : "text-foreground",
          )}
        >
          {title}
        </span>
        {compact ? null : (
          <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">
            {description}
          </span>
        )}
      </span>
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-flat transition-interactive duration-200",
          compact
            ? "border-primary-foreground/15 bg-primary-foreground/10 text-primary-foreground"
            : "border-border bg-surface-elevated text-foreground group-hover:border-strong group-hover:text-primary",
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
    </a>
  );
}
