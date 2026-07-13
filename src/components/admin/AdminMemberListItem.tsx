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
  const profile = parseSsafyProfile(member.display_name ?? member.mm_username);
  const displayName =
    profile.displayName ?? member.display_name ?? member.mm_username;
  const yearLabel = formatSsafyMemberLifecycleLabel(
    member.year ?? getCurrentSsafyYear(),
  );
  const campus = member.campus ?? profile.campus ?? "캠퍼스 미입력";
  const avatarLabel = (displayName || member.mm_username || "?")
    .trim()
    .charAt(0)
    .toUpperCase();
  const hasAvatar = Boolean(member.avatar_content_type || member.avatar_url);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const avatarUrl = useMemo(() => {
    const query = member.updated_at
      ? `?v=${encodeURIComponent(member.updated_at)}`
      : "";
    return `/api/admin/members/${member.id}/avatar${query}`;
  }, [member.id, member.updated_at]);

  return (
    <article className="grid min-w-0 gap-4 rounded-2xl border border-border/80 bg-surface-inset p-4 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:items-center">
      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface-muted text-lg font-semibold text-foreground">
        {hasAvatar && !avatarFailed ? (
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
          {member.must_change_password ? (
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
          @{member.mm_username}
        </p>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>{yearLabel}</span>
          <span className="truncate">{campus}</span>
          <span>최근 수정 {formatDateTime(member.updated_at)}</span>
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
