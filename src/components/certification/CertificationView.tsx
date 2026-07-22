"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { parseSsafyProfile } from "@/lib/mm-profile";
import { trackProductEvent } from "@/lib/product-events";
import {
  getCurrentSsafyYear,
  formatSsafyYearLabel,
} from "@/lib/ssafy-year";
import {
  getCertificationRoleLabel,
  getCertificationScheme,
} from "@/lib/certification-scheme";
import type { CohortCardTheme } from "@/lib/cohort-card-themes";
import CertificationCardFrame from "@/components/certification/CertificationCardFrame";
import CertificationQrButton from "@/components/certification/CertificationQrButton";
import { formatKoreanDateTime } from "@/lib/datetime";

type Member = {
  mattermostUsername?: string | null;
  displayName?: string | null;
  generation?: number | null;
  campus?: string | null;
  graduateVerifiedAt?: string | null;
  profileImageUrl?: string | null;
};

export default function CertificationView({
  member,
  initialTimestamp,
  disableTracking = false,
  cohortCardThemes,
  cardClassName,
}: {
  member: Member;
  initialTimestamp: string;
  disableTracking?: boolean;
  cohortCardThemes?: readonly CohortCardTheme[] | null;
  cardClassName?: string;
}) {
  const [now, setNow] = useState(() => new Date(initialTimestamp));
  const [isAvatarOpen, setAvatarOpen] = useState(false);
  const [isQrOpen, setQrOpen] = useState(false);
  const profile = parseSsafyProfile(
    member.displayName ?? member.mattermostUsername ?? "",
  );
  const hasTrackedViewRef = useRef(false);
  const generation = member.generation ?? getCurrentSsafyYear();
  const roleLabel = getCertificationRoleLabel(generation, {
    graduateVerifiedAt: member.graduateVerifiedAt,
  });
  const scheme = getCertificationScheme(generation, cohortCardThemes, {
    graduateVerifiedAt: member.graduateVerifiedAt,
  });
  const campusLabel = member.campus ?? profile.campus ?? null;
  const yearLabel = generation > 0 ? formatSsafyYearLabel(generation) : null;
  const hasProfileImage = Boolean(member.profileImageUrl);
  const avatarSrc = member.profileImageUrl ?? "/avatar-default.svg";
  const name = profile.displayName ?? member.displayName ?? "이름 미지정";

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (disableTracking) {
      return;
    }
    if (hasTrackedViewRef.current) {
      return;
    }
    hasTrackedViewRef.current = true;
    trackProductEvent({
      eventName: "certification_view",
      targetType: "member",
      properties: {
        generation,
        campus: member.campus ?? profile.campus ?? null,
        role: roleLabel,
      },
    });
  }, [
    disableTracking,
    member.campus,
    generation,
    profile.campus,
    roleLabel,
  ]);

  useEffect(() => {
    if (!isAvatarOpen) {
      return;
    }
    const originalOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAvatarOpen(false);
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isAvatarOpen]);

  const dateLabel = useMemo(() => {
    return formatKoreanDateTime(now, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }, [now]);

  const timeLabel = useMemo(() => {
    return formatKoreanDateTime(now, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, [now]);

  return (
    <div className="mt-6 w-full min-w-0 max-w-full">
      <CertificationCardFrame
        className={cardClassName}
        scheme={scheme}
        eyebrow="SSAFY"
        name={name}
        roleLabel={roleLabel}
        yearLabel={yearLabel}
        campusLabel={campusLabel}
        description=""
        onCardClick={() => setQrOpen(true)}
        footer={
          <div className="flex h-full min-w-0 flex-nowrap items-center justify-between gap-[clamp(0px,2cqw,2rem)] leading-[clamp(0px,3cqw,1.5rem)]">
            <div
              data-certification-card-timestamp-row
              className="flex min-w-0 flex-1 items-center gap-[clamp(0.35rem,1.5cqw,1.5rem)]"
            >
              <span className={cn("shrink-0 text-[clamp(0px,3cqw,1.5rem)] font-medium uppercase tracking-[0.12em]", scheme.mutedTextClassName)}>
                인증 시간
              </span>
              <time
                data-certification-card-timestamp
                className="min-w-0 truncate whitespace-nowrap text-[clamp(0px,3cqw,1.5rem)] font-semibold"
              >
                {dateLabel} {timeLabel}
              </time>
            </div>
            <div
              data-certification-qr-touch-target
              className="relative flex min-w-0 items-center justify-center"
            >
              <CertificationQrButton
                roleLabel={roleLabel}
                open={isQrOpen}
                onOpenChange={setQrOpen}
                className={cn(
                  scheme.qrButtonClassName,
                  "relative !h-[clamp(0px,5.9cqw,4rem)] !min-h-0 !w-auto !min-w-0 !rounded-[clamp(0px,2.5cqw,2.5rem)] !px-[clamp(0px,2.1cqw,2.1rem)] text-[clamp(0px,2.4cqw,1.25rem)] whitespace-nowrap after:absolute after:left-1/2 after:top-1/2 after:min-h-11 after:min-w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']",
                )}
              />
            </div>
          </div>
        }
        avatarSrc={avatarSrc}
        avatarAlt={hasProfileImage ? "프로필" : "기본 프로필 이미지"}
        avatarOnClick={hasProfileImage ? () => setAvatarOpen(true) : undefined}
        avatarButtonLabel="프로필 이미지 크게 보기"
      />

      {hasProfileImage && isAvatarOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6">
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => setAvatarOpen(false)}
            aria-label="확대 이미지 닫기"
          />
          <button
            type="button"
            className="absolute right-6 top-6 z-10 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white"
            onClick={() => setAvatarOpen(false)}
            aria-label="닫기"
          >
            ✕
          </button>
          <div className="relative z-10 aspect-square w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-white/5 shadow-overlay">
            <Image
              src={avatarSrc}
              alt="프로필 확대 이미지"
              fill
              sizes="(max-width: 768px) 90vw, 448px"
              unoptimized
              className="object-contain"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
