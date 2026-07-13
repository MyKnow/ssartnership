"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AdminMember } from "@/components/admin/member-manager/selectors";
import { formatKoreanDateTimeToMinute } from "@/lib/datetime";
import { parseSsafyProfile } from "@/lib/mm-profile";
import {
  formatSsafyMemberLifecycleLabel,
  getCurrentSsafyYear,
} from "@/lib/ssafy-year";

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "-"
    : formatKoreanDateTimeToMinute(parsed);
}

export default function AdminMemberListItem({
  member,
}: {
  member: AdminMember;
}) {
  const profile = parseSsafyProfile(member.displayName ?? member.mmUsername);
  const displayName =
    profile.displayName ?? member.displayName ?? member.mmUsername;
  const yearLabel = formatSsafyMemberLifecycleLabel(
    member.generation ?? getCurrentSsafyYear(),
  );
  const campus = member.campus ?? profile.campus ?? "캠퍼스 미입력";
  const avatarLabel = (displayName || member.mmUsername || "?")
    .trim()
    .charAt(0)
    .toUpperCase();
  const [avatarFailed, setAvatarFailed] = useState(false);
  const avatarUrl = useMemo(() => {
    const query = member.updatedAt
      ? `?v=${encodeURIComponent(member.updatedAt)}`
      : "";
    return `/api/admin/members/${member.id}/avatar${query}`;
  }, [member.id, member.updatedAt]);

  return (
    <article className="grid min-w-0 gap-4 rounded-2xl border border-border/80 bg-surface-inset p-4 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:items-center">
      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface-muted text-lg font-semibold text-foreground">
        {member.hasProfileImage && !avatarFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          <span aria-hidden="true">{avatarLabel || "?"}</span>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="max-w-full truncate text-base font-semibold text-foreground">
            {displayName}
          </h3>
          {member.mustChangePassword ? (
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
              비밀번호 변경 필요
            </span>
          ) : (
            <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200">
              정상
            </span>
          )}
        </div>
        <p className="text-token mt-1 truncate text-sm text-muted-foreground">
          @{member.mmUsername}
        </p>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>{yearLabel}</span>
          <span className="truncate">{campus}</span>
          <span>최근 수정 {formatDateTime(member.updatedAt)}</span>
        </div>
      </div>

      <Link
        href={`/admin/members/${member.id}`}
        className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[1rem] border border-primary/10 bg-primary-soft px-4 text-sm font-semibold text-primary shadow-flat transition-interactive hover:-translate-y-px hover:border-primary/20"
      >
        상세 보기
      </Link>
    </article>
  );
}
