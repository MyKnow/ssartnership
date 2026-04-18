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
import CertificationCardFrame from "@/components/certification/CertificationCardFrame";
import CertificationQrButton from "@/components/certification/CertificationQrButton";
import { formatKoreanDateTime } from "@/lib/datetime";

type Member = {
  id?: string | null;
  mm_username: string;
  display_name?: string | null;
  year?: number | null;
  campus?: string | null;
  avatar_content_type?: string | null;
  avatar_base64?: string | null;
};

export default function CertificationView({
  member,
  initialTimestamp,
  disableTracking = false,
}: {
  member: Member;
  initialTimestamp: string;
  disableTracking?: boolean;
}) {
  const [now, setNow] = useState(() => new Date(initialTimestamp));
  const [isAvatarOpen, setAvatarOpen] = useState(false);
  const profile = parseSsafyProfile(member.display_name ?? member.mm_username);
  const hasTrackedViewRef = useRef(false);
  const year = member.year ?? getCurrentSsafyYear();
  const roleLabel = getCertificationRoleLabel(year);
  const scheme = getCertificationScheme(year);
  const campusLabel = member.campus ?? profile.campus ?? null;
  const yearLabel = year > 0 ? formatSsafyYearLabel(year) : null;
  const hasCustomAvatar = Boolean(member.avatar_base64 && member.avatar_content_type);
  const avatarSrc = hasCustomAvatar
    ? `data:${member.avatar_content_type};base64,${member.avatar_base64}`
    : "/avatar-default.svg";
  const name = profile.displayName ?? member.display_name ?? "이름 미지정";

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
        year,
        campus: member.campus ?? profile.campus ?? null,
        role: roleLabel,
      },
    });
  }, [
    disableTracking,
    member.campus,
    year,
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
    <div className="mt-6 w-full">
      <CertificationCardFrame
        scheme={scheme}
        eyebrow="SSAFY 인증"
        name={name}
        roleLabel={roleLabel}
        yearLabel={yearLabel}
        campusLabel={campusLabel}
        description=""
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 sm:items-end">
            <div className="min-w-0 space-y-1">
              <p className={cn("text-xs font-medium uppercase tracking-[0.16em]", scheme.mutedTextClassName)}>
                인증 시간
              </p>
              <p className="whitespace-nowrap text-sm font-semibold sm:text-base">
                {dateLabel} {timeLabel}
              </p>
              <div className={cn("flex items-center gap-2 text-xs", scheme.subduedTextClassName)}>
                <span className={cn("inline-flex h-2 w-2 rounded-full", scheme.accentClassName)} />
                {year === 0 ? "운영진 인증" : "교육생 인증"}
              </div>
            </div>
            <CertificationQrButton
              roleLabel={roleLabel}
              className="!h-11 !min-h-11 !px-4 text-sm whitespace-nowrap"
            />
          </div>
        }
        avatarSrc={avatarSrc}
        avatarAlt={hasCustomAvatar ? "프로필" : "기본 프로필 이미지"}
        avatarOnClick={hasCustomAvatar ? () => setAvatarOpen(true) : undefined}
        avatarButtonLabel="프로필 이미지 크게 보기"
      />

      {hasCustomAvatar && isAvatarOpen ? (
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
          <div className="relative z-10 aspect-square w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-white/5 shadow-2xl">
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
