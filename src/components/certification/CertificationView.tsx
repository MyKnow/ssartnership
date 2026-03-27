"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { parseSsafyProfile } from "@/lib/mm-profile";

type Member = {
  mm_username: string;
  display_name?: string | null;
  region?: string | null;
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
  const { notify } = useToast();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeLabel = useMemo(() => {
    return now.toLocaleString("ko-KR", {
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
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
  const profile = parseSsafyProfile(member.display_name ?? member.mm_username);

  return (
    <div className="mt-6">
      <div className="relative overflow-hidden rounded-[32px] border border-white/15 bg-gradient-to-br from-[#0b1220] via-[#0f172a] to-[#111827] p-6 text-white shadow-[0_25px_80px_rgba(15,23,42,0.5)]">
        <div className="absolute inset-0 opacity-40">
          <div className="absolute -left-20 top-10 h-32 w-80 rotate-12 rounded-full bg-cyan-400/40 blur-3xl" />
          <div className="absolute -right-20 bottom-10 h-32 w-80 -rotate-12 rounded-full bg-sky-500/40 blur-3xl" />
        </div>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-6 top-6 h-16 w-16 rounded-full border border-white/10 bg-white/5" />
          <div className="absolute right-8 top-10 h-10 w-10 rounded-full border border-white/10 bg-white/5" />
          <div className="absolute bottom-8 left-10 h-12 w-12 rounded-full border border-white/10 bg-white/5" />
        </div>
        <div className="relative flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
                SSAFY Trainee
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                {profile.displayName ?? member.display_name ?? member.mm_username}
              </h2>
              <p className="mt-1 text-sm text-slate-200">
                {member.campus ?? member.region ?? "캠퍼스"}{" "}
                {member.class_number ? `${member.class_number}반` : ""}
              </p>
            </div>
            <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-white/20 bg-white/10 shadow-[0_12px_30px_rgba(14,165,233,0.35)]">
              {avatarSrc ? (
                <Image
                  src={avatarSrc}
                  alt="프로필"
                  fill
                  sizes="80px"
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-slate-200">
                  사진 없음
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-300">MM 아이디</span>
              <span className="font-medium">@{member.mm_username}</span>
            </div>
            <div className="flex flex-col gap-1 text-right">
              <span className="text-xs text-slate-300">인증 시간</span>
              <span className="font-semibold">{timeLabel}</span>
            </div>
          </div>

          <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
            <div className="absolute inset-y-0 left-0 w-1/3 animate-[cert-slide_3s_linear_infinite] rounded-full bg-cyan-300/70" />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            실시간 인증 상태
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-300">
              회원 탈퇴 시 저장된 인증 정보가 삭제됩니다.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" href="/auth/change-password">
                비밀번호 변경하기
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  const first = window.confirm(
                    "정말 탈퇴하시겠습니까? 저장된 인증 정보가 삭제됩니다.",
                  );
                  if (!first) {
                    return;
                  }
                  const second = window.confirm(
                    "한 번 더 확인합니다. 탈퇴하면 되돌릴 수 없습니다.",
                  );
                  if (!second) {
                    return;
                  }
                  const response = await fetch("/api/mm/delete", { method: "POST" });
                  if (response.ok) {
                    notify("회원 탈퇴가 완료되었습니다.");
                    window.location.href = "/";
                    return;
                  }
                  notify("회원 탈퇴에 실패했습니다.");
                }}
              >
                회원 탈퇴
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
