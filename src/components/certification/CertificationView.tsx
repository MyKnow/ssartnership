"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { parseSsafyProfile } from "@/lib/mm-profile";
import { trackProductEvent } from "@/lib/product-events";
import { getCurrentSsafyYear } from "@/lib/ssafy-year";
import CertificationQrButton from "@/components/certification/CertificationQrButton";

type Member = {
  mm_username: string;
  display_name?: string | null;
  year?: number | null;
  campus?: string | null;
  class_number?: number | null;
  avatar_content_type?: string | null;
  avatar_base64?: string | null;
};

export default function CertificationView({
  member,
  initialTimestamp,
}: {
  member: Member;
  initialTimestamp: string;
}) {
  const [now, setNow] = useState(() => new Date(initialTimestamp));
  const [isAvatarOpen, setAvatarOpen] = useState(false);
  const profile = parseSsafyProfile(member.display_name ?? member.mm_username);
  const hasTrackedViewRef = useRef(false);
  const year = member.year ?? getCurrentSsafyYear();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
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
        classNumber: member.class_number ?? profile.classNumber ?? null,
      },
    });
  }, [
    member.campus,
    member.class_number,
    year,
    profile.campus,
    profile.classNumber,
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
    return now.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Seoul",
    });
  }, [now]);

  const timeLabel = useMemo(() => {
    return now.toLocaleTimeString("ko-KR", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Seoul",
    });
  }, [now]);

  const avatarSrc =
    member.avatar_base64 && member.avatar_content_type
      ? `data:${member.avatar_content_type};base64,${member.avatar_base64}`
      : null;

  return (
    <div className="mt-6">
      <div className="relative min-w-0 overflow-hidden rounded-[32px] border border-white/15 bg-gradient-to-br from-[#0b1220] via-[#0f172a] to-[#111827] p-5 text-white shadow-[0_25px_80px_rgba(15,23,42,0.5)] sm:p-6">
        <div className="absolute inset-0 opacity-40">
          <div className="absolute -left-20 top-10 h-32 w-80 rotate-12 rounded-full bg-cyan-400/40 blur-3xl" />
          <div className="absolute -right-20 bottom-10 h-32 w-80 -rotate-12 rounded-full bg-sky-500/40 blur-3xl" />
        </div>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-6 top-6 h-16 w-16 rounded-full border border-white/10 bg-white/5" />
          <div className="absolute right-8 top-10 h-10 w-10 rounded-full border border-white/10 bg-white/5" />
          <div className="absolute bottom-8 left-10 h-12 w-12 rounded-full border border-white/10 bg-white/5" />
        </div>
        <div className="relative flex flex-col pb-20 sm:pb-24">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
                SSAFY Trainee
              </p>
              <h2 className="mt-2 break-keep text-xl font-semibold sm:text-2xl">
                {profile.displayName ?? member.display_name ?? member.mm_username}
              </h2>
              <p className="mt-1 text-sm text-slate-200">
                {`${year}기 · `}{member.campus ?? profile.campus ?? "캠퍼스"}{" "}
                {member.class_number ? `${member.class_number}반` : ""}
              </p>
            </div>
            <div className="relative h-[clamp(4.75rem,22vw,7rem)] w-[clamp(4.75rem,22vw,7rem)] shrink-0 overflow-hidden rounded-3xl border border-white/20 bg-white/10 shadow-[0_12px_30px_rgba(14,165,233,0.35)]">
              {avatarSrc ? (
                <button
                  type="button"
                  className="relative block h-full w-full"
                  onClick={() => setAvatarOpen(true)}
                  aria-label="프로필 이미지 크게 보기"
                >
                  <Image
                    src={avatarSrc}
                    alt="프로필"
                    fill
                    sizes="112px"
                    unoptimized
                    className="object-cover"
                  />
                </button>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-slate-200">
                  사진 없음
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-x-4 gap-y-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm sm:gap-x-6">
            <div className="min-w-0 flex-auto">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-300">MM 아이디</span>
                <span className="break-all font-medium">@{member.mm_username}</span>
              </div>
            </div>
            <div className="ml-auto flex shrink-0 flex-col gap-1 text-right">
              <span className="text-xs text-slate-300">인증 시간</span>
              <span className="whitespace-nowrap text-sm font-semibold sm:text-base">
                {dateLabel} {timeLabel}
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-4">
            <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
              <div className="absolute inset-y-0 left-0 w-1/3 animate-[cert-slide_3s_linear_infinite] rounded-full bg-cyan-300/70" />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              실시간 인증 상태
            </div>
          </div>

          <div className="absolute bottom-0 right-0 flex justify-end">
            <CertificationQrButton />
          </div>
        </div>
      </div>

      {avatarSrc && isAvatarOpen ? (
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
