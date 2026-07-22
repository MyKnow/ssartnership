"use client";

import Image from "next/image";
import { type CSSProperties, type MouseEvent, type ReactNode } from "react";
import Badge from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import type { CertificationScheme } from "@/lib/certification-scheme";

type CertificationCardFrameProps = {
  scheme: CertificationScheme;
  eyebrow: string;
  name: string;
  roleLabel: string;
  yearLabel?: string | null;
  campusLabel?: string | null;
  description: ReactNode;
  footer: ReactNode;
  avatarSrc: string;
  avatarAlt: string;
  avatarOnClick?: () => void;
  avatarButtonLabel?: string;
  onCardClick?: () => void;
  className?: string;
  style?: CSSProperties;
};

export default function CertificationCardFrame({
  scheme,
  eyebrow,
  name,
  roleLabel,
  yearLabel,
  campusLabel,
  description,
  footer,
  avatarSrc,
  avatarAlt,
  avatarOnClick,
  avatarButtonLabel,
  onCardClick,
  className,
  style,
}: CertificationCardFrameProps) {
  const handleCardClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!onCardClick) {
      return;
    }
    const target = event.target;
    if (target instanceof Element && target.closest("button, a, input, select, textarea")) {
      return;
    }
    onCardClick();
  };

  return (
    <div className="@container/cert w-full max-w-full min-w-0">
      <div
        className={cn(
          "relative isolate mx-auto aspect-[16/9] w-full max-w-full min-w-0 overflow-hidden rounded-[clamp(0px,3cqw,3rem)] border p-[clamp(0px,4cqw,4rem)] shadow-overlay ring-1",
          onCardClick
            ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
            : null,
          scheme.textClassName,
          scheme.cardClassName,
          scheme.frameRingClassName,
          className,
        )}
        onClick={onCardClick ? handleCardClick : undefined}
        data-testid="certification-card-frame"
        data-certification-card-clickable={onCardClick ? "true" : undefined}
        style={{ ...scheme.style, ...style }}
      >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 opacity-80">
          <div className="cert-shape-a absolute -left-[2.5cqw] top-[3.5cqw] h-[12.5cqw] w-[12.5cqw] rounded-[3.5cqw] border border-white/[0.1] bg-white/[0.03] shadow-[inset_0_0.125cqw_0_rgba(255,255,255,0.06)] motion-reduce:animate-none" />
          <div
            className={cn(
              "cert-shape-b absolute left-[28%] top-[18%] h-[15cqw] w-[15cqw] rounded-full opacity-[0.12] blur-[8cqw] motion-reduce:animate-none",
              scheme.accentClassName,
            )}
          />
          <div className="cert-shape-c absolute bottom-[24%] right-[18%] h-[10cqw] w-[16cqw] rounded-[5cqw] border border-white/[0.08] bg-white/[0.025] shadow-[inset_0_0.125cqw_0_rgba(255,255,255,0.05)] motion-reduce:animate-none" />
        </div>
        <div
          className={cn(
            "cert-glow-a absolute inset-0 bg-no-repeat [background-size:72%_72%] opacity-75 mix-blend-screen motion-reduce:animate-none",
            scheme.glowClassName,
          )}
        />
        <div
          className={cn(
            "cert-glow-b absolute inset-0 bg-no-repeat [background-size:88%_88%] opacity-45 mix-blend-screen blur-[5cqw] motion-reduce:animate-none",
            scheme.glowClassName,
          )}
        />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.16)_0%,transparent_28%,transparent_72%,rgba(255,255,255,0.05)_100%)] opacity-70" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.2),transparent_42%)] opacity-70" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.04),transparent_18%,transparent_84%,rgba(15,23,42,0.14))] mix-blend-soft-light" />
        <div className="absolute -right-[7cqw] -top-[6cqw] h-[22cqw] w-[22cqw] rounded-full border border-white/8 opacity-40" />
        <div className="absolute -right-[1cqw] top-[7cqw] h-[10cqw] w-[10cqw] rounded-full border border-white/7 opacity-30" />
        <div className="absolute inset-x-0 bottom-0 h-[0.125cqw] bg-white/10" />
      </div>

      <div className="relative grid h-full min-h-0 grid-cols-[minmax(0,1fr)_clamp(0px,28cqw,28rem)] grid-rows-[minmax(0,1fr)_minmax(clamp(0px,14cqw,11rem),auto)] gap-x-[clamp(0px,4cqw,4rem)] gap-y-[clamp(0px,2cqw,2rem)]">
        <div
          data-certification-card-identity
          className="row-start-1 col-start-1 min-h-0 min-w-0 space-y-[clamp(0px,1cqw,1rem)] overflow-hidden"
        >
          <div className="certification-card-identity-header grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,auto)] items-start gap-[clamp(0px,1.5cqw,1.5rem)]">
            <div
              data-certification-card-title
              className="min-w-0 space-y-[clamp(0px,1.8cqw,1.8rem)]"
            >
              <p className={cn("text-[clamp(0px,2.4cqw,1.5rem)] font-semibold uppercase tracking-[0.3em]", scheme.mutedTextClassName)}>
                {eyebrow}
              </p>
              <h2 className="truncate break-keep text-[clamp(0px,6cqw,5rem)] font-semibold leading-[1.03]">
                {name}
              </h2>
            </div>
            <div
              data-certification-card-chip-group
              className="certification-card-chip-group flex min-w-0 max-w-full flex-wrap items-center justify-end gap-[clamp(0px,1.6cqw,1.6rem)]"
              aria-label="기수 캠퍼스 역할"
            >
              {yearLabel ? (
                <Badge
                  className={cn(
                    scheme.yearChipClassName,
                    "!px-[clamp(0px,1.5cqw,1.5rem)] !py-[clamp(0px,0.7cqw,0.7rem)] !text-[clamp(0px,2.4cqw,1.5rem)]",
                  )}
                >
                  {yearLabel}
                </Badge>
              ) : null}
              {campusLabel ? (
                <Badge
                  className={cn(
                    scheme.campusBadgeClassName,
                    "min-w-0 max-w-[clamp(0px,24cqw,24rem)] truncate !px-[clamp(0px,1.5cqw,1.5rem)] !py-[clamp(0px,0.7cqw,0.7rem)] !text-[clamp(0px,2.4cqw,1.5rem)]",
                  )}
                >
                  {campusLabel}
                </Badge>
              ) : null}
              <Badge
                className={cn(
                  scheme.roleBadgeClassName,
                  "!px-[clamp(0px,1.5cqw,1.5rem)] !py-[clamp(0px,0.7cqw,0.7rem)] !text-[clamp(0px,2.4cqw,1.5rem)]",
                )}
              >
                {roleLabel}
              </Badge>
            </div>
          </div>

          {description ? (
            <p className={cn("max-w-[30ch] truncate break-keep text-[clamp(0.65rem,1.6cqw,1rem)] leading-[1.5]", scheme.subduedTextClassName)}>
              {description}
            </p>
          ) : null}
        </div>

        <div className={cn(
          "relative row-start-1 col-start-2 aspect-square w-full max-w-full self-start overflow-hidden rounded-[clamp(0px,3cqw,3rem)] border bg-white/10 shadow-[0_3.2cqw_6.7cqw_rgba(15,23,42,0.26)] ring-1 animate-[cert-float_7s_ease-in-out_infinite] motion-reduce:animate-none",
          scheme.avatarFrameClassName,
        )}
          data-certification-card-avatar
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.24),transparent_35%)] opacity-80" />
          <div className="pointer-events-none absolute inset-x-[2cqw] top-[2cqw] h-px rounded-full bg-white/20" />
          <div className="pointer-events-none absolute inset-x-[2cqw] bottom-[2cqw] h-[0.5cqw] rounded-full bg-white/15" />
          {avatarOnClick ? (
            <button
              type="button"
              className="relative block h-full w-full"
              onClick={avatarOnClick}
              aria-label={avatarButtonLabel ?? "프로필 이미지 크게 보기"}
            >
              <Image
                src={avatarSrc}
                alt={avatarAlt}
                fill
                loading="eager"
                sizes="(max-width: 640px) 116px, (max-width: 1024px) 156px, 168px"
                unoptimized
                className="object-cover"
              />
            </button>
          ) : (
              <Image
              src={avatarSrc}
              alt={avatarAlt}
              fill
              loading="eager"
              sizes="(max-width: 640px) 116px, (max-width: 1024px) 156px, 168px"
              unoptimized
              className="object-cover"
            />
          )}
        </div>

        <div
          data-certification-card-footer
          className={cn(
            "row-start-2 col-span-2 min-h-[clamp(0px,14cqw,11rem)] min-w-0 max-w-full overflow-hidden rounded-[clamp(0px,3cqw,3rem)] border px-[clamp(0px,4cqw,4rem)] py-[clamp(0px,4cqw,4rem)] shadow-[inset_0_0.125cqw_0_rgba(255,255,255,0.06)] backdrop-blur-md",
            scheme.panelClassName,
          )}
        >
          {footer}
        </div>
      </div>
      </div>
    </div>
  );
}
