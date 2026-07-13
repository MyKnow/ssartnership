"use client";

import Image from "next/image";
import { type CSSProperties, type ReactNode } from "react";
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
  className,
  style,
}: CertificationCardFrameProps) {
  return (
    <div
      className={cn(
        "@container/cert relative mx-auto aspect-[1.58/1] w-full min-w-0 overflow-hidden rounded-[4%] border p-[4%] shadow-overlay ring-1 transform-gpu",
        scheme.textClassName,
        scheme.cardClassName,
        scheme.frameRingClassName,
        className,
      )}
      data-testid="certification-card-frame"
      style={{ ...scheme.style, ...style }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 opacity-80">
          <div className="cert-shape-a absolute -left-5 top-7 h-24 w-24 rounded-[28px] border border-white/[0.1] bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] motion-reduce:animate-none sm:h-28 sm:w-28" />
          <div
            className={cn(
              "cert-shape-b absolute left-[28%] top-[18%] h-28 w-28 rounded-full opacity-[0.12] blur-3xl motion-reduce:animate-none sm:h-36 sm:w-36",
              scheme.accentClassName,
            )}
          />
          <div className="cert-shape-c absolute bottom-[24%] right-[18%] h-20 w-32 rounded-full border border-white/[0.08] bg-white/[0.025] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] motion-reduce:animate-none sm:h-24 sm:w-36" />
        </div>
        <div
          className={cn(
            "cert-glow-a absolute inset-0 bg-no-repeat [background-size:72%_72%] opacity-75 mix-blend-screen motion-reduce:animate-none",
            scheme.glowClassName,
          )}
        />
        <div
          className={cn(
            "cert-glow-b absolute inset-0 bg-no-repeat [background-size:88%_88%] opacity-45 mix-blend-screen blur-2xl motion-reduce:animate-none",
            scheme.glowClassName,
          )}
        />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.16)_0%,transparent_28%,transparent_72%,rgba(255,255,255,0.05)_100%)] opacity-70" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.2),transparent_42%)] opacity-70" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.04),transparent_18%,transparent_84%,rgba(15,23,42,0.14))] mix-blend-soft-light" />
        <div className="absolute -right-14 -top-12 h-44 w-44 rounded-full border border-white/8 opacity-40" />
        <div className="absolute -right-2 top-14 h-20 w-20 rounded-full border border-white/7 opacity-30" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-white/10" />
      </div>

      <div className="relative grid h-full grid-cols-[minmax(0,1fr)_36.95cqw] grid-rows-[minmax(0,1fr)_20.65cqw] gap-x-[4cqw] gap-y-[2cqw]">
        <div
          data-certification-card-identity
          className="row-start-1 col-start-1 min-w-0 space-y-[1cqw]"
        >
          <div className="flex items-start justify-between gap-[2cqw]">
            <div className="min-w-0 space-y-[0.5cqw]">
              <p className={cn("text-[clamp(0.5rem,1.5cqw,0.875rem)] font-semibold uppercase tracking-[0.3em]", scheme.mutedTextClassName)}>
                {eyebrow}
              </p>
              <h2 className="truncate break-keep text-[clamp(1rem,5.2cqw,3rem)] font-semibold leading-[1.03]">
                {name}
              </h2>
            </div>
            <Badge
              className={cn(
                scheme.roleBadgeClassName,
                "!px-[1.5cqw] !py-[0.7cqw] text-[clamp(0.625rem,1.7cqw,1rem)]",
              )}
            >
              {roleLabel}
            </Badge>
          </div>

          <div className="flex min-w-0 flex-nowrap items-center gap-[1cqw]">
            {yearLabel ? (
              <Badge
                className={cn(
                  scheme.yearChipClassName,
                  "!px-[1.5cqw] !py-[0.7cqw] text-[clamp(0.625rem,1.7cqw,1rem)]",
                )}
              >
                {yearLabel}
              </Badge>
            ) : null}
            {campusLabel ? (
              <Badge
                className={cn(
                  scheme.campusBadgeClassName,
                  "min-w-0 max-w-[24cqw] truncate !px-[1.5cqw] !py-[0.7cqw] text-[clamp(0.625rem,1.7cqw,1rem)]",
                )}
              >
                {campusLabel}
              </Badge>
            ) : null}
          </div>

            {description ? (
              <p className={cn("max-w-[30ch] text-sm leading-6", scheme.subduedTextClassName)}>
                {description}
              </p>
            ) : null}
        </div>

        <div className={cn(
          "relative row-start-1 col-start-2 aspect-square w-full self-start overflow-hidden rounded-[3cqw] border bg-white/10 shadow-[0_24px_50px_rgba(15,23,42,0.26)] ring-1 animate-[cert-float_7s_ease-in-out_infinite] motion-reduce:animate-none",
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
            "row-start-2 col-span-2 rounded-[3cqw] border px-[2.4cqw] py-[2cqw] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md",
            scheme.panelClassName,
          )}
        >
          {footer}
        </div>
      </div>
    </div>
  );
}
