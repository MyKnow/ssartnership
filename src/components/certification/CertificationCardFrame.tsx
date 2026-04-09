"use client";

import Image from "next/image";
import { type ReactNode } from "react";
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
}: CertificationCardFrameProps) {
  return (
    <div
      className={cn(
        "relative mx-auto min-h-[250px] min-w-0 max-w-2xl overflow-hidden rounded-[clamp(24px,4vw,38px)] border p-3 text-white shadow-2xl transform-gpu sm:aspect-[1.58/1] sm:min-h-0 sm:p-5",
        scheme.cardClassName,
        className,
      )}
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
        <div className="absolute inset-x-6 top-0 h-px bg-white/12" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-white/10" />
      </div>

      <div className="relative grid h-full grid-cols-[minmax(0,1fr)_7.25rem] grid-rows-[auto_auto] gap-x-3 gap-y-4 sm:grid-cols-[minmax(0,1fr)_8.75rem] sm:grid-rows-[minmax(0,1fr)_auto] sm:gap-x-4 lg:grid-cols-[minmax(0,1fr)_10.5rem] lg:gap-x-5">
        <div className="min-w-0 space-y-4 row-start-1 col-start-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <p className={cn("text-[10px] font-semibold uppercase tracking-[0.3em]", scheme.mutedTextClassName)}>
                {eyebrow}
              </p>
              <h2 className="break-keep text-[clamp(1.5rem,4.8vw,2.35rem)] font-semibold leading-[1.03]">
                {name}
              </h2>
            </div>
            <Badge className={scheme.roleBadgeClassName}>{roleLabel}</Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {yearLabel ? <Badge className={scheme.yearChipClassName}>{yearLabel}</Badge> : null}
            {campusLabel ? (
              <Badge className="bg-white/10 text-white/90 ring-1 ring-white/10">
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

        <div className="relative aspect-square w-full self-start overflow-hidden rounded-[26px] border border-white/15 bg-white/10 shadow-[0_24px_50px_rgba(15,23,42,0.26)] ring-1 ring-white/10 animate-[cert-float_10s_ease-in-out_infinite] motion-reduce:animate-none row-start-1 col-start-2">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.24),transparent_35%)] opacity-80" />
          <div className="pointer-events-none absolute inset-x-3 top-3 h-px rounded-full bg-white/20" />
          <div className="pointer-events-none absolute inset-x-3 bottom-3 h-1 rounded-full bg-white/15" />
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
              sizes="(max-width: 640px) 116px, (max-width: 1024px) 156px, 168px"
              unoptimized
              className="object-cover"
            />
          )}
        </div>

        <div
          className={cn(
            "rounded-[24px] border px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md row-start-2 col-span-2",
            scheme.panelClassName,
          )}
        >
          {footer}
        </div>
      </div>
    </div>
  );
}
