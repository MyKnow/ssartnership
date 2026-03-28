"use client";

import Image from "next/image";
import { parseSsafyProfile } from "@/lib/mm-profile";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import SubmitButton from "@/components/ui/SubmitButton";

type AdminMember = {
  id: string;
  mm_user_id: string;
  mm_username: string;
  display_name?: string | null;
  campus?: string | null;
  class_number?: number | null;
  must_change_password: boolean;
  avatar_content_type?: string | null;
  avatar_base64?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Seoul",
});

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return dateTimeFormatter.format(parsed);
}

export default function AdminMemberCard({
  member,
  updateAction,
  deleteAction,
}: {
  member: AdminMember;
  updateAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  const profile = parseSsafyProfile(member.display_name ?? member.mm_username);
  const displayName =
    profile.displayName ?? member.display_name ?? member.mm_username;
  const campus = member.campus ?? profile.campus ?? "";
  const classNumber = member.class_number ?? profile.classNumber ?? "";
  const avatarSrc =
    member.avatar_base64 && member.avatar_content_type
      ? `data:${member.avatar_content_type};base64,${member.avatar_base64}`
      : null;
  const topPanelSizeClass = "md:h-[196px]";

  const handleDeleteSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const ok = window.confirm(
      `정말 ${displayName}(@${member.mm_username}) 회원을 삭제하시겠습니까?`,
    );
    if (!ok) {
      event.preventDefault();
    }
  };

  return (
    <Card className="grid gap-5">
      <div className="grid gap-5 md:grid-cols-[196px_minmax(0,1fr)] md:items-stretch">
        <div
          className={`relative aspect-square w-full max-w-[196px] overflow-hidden rounded-[28px] border border-border bg-surface-muted md:max-w-none ${topPanelSizeClass}`}
        >
          {avatarSrc ? (
            <Image
              src={avatarSrc}
              alt={`${displayName} 프로필 이미지`}
              fill
              sizes="196px"
              unoptimized
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-4xl font-semibold text-muted-foreground">
              {displayName.slice(0, 1)}
            </div>
          )}
        </div>

        <div className={`grid gap-5 ${topPanelSizeClass}`}>
          <div className="grid h-full gap-3 rounded-2xl border border-border bg-surface-muted p-4 text-sm text-muted-foreground">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-2xl font-semibold text-foreground">
                  {displayName}
                </h3>
                <span className="text-sm text-muted-foreground">
                  @{member.mm_username}
                </span>
              </div>
              <Badge
                className={
                  member.must_change_password
                    ? "border border-danger/30 bg-danger/10 text-danger"
                    : "bg-surface text-foreground"
                }
              >
                {member.must_change_password ? "비밀번호 변경 필요" : "정상"}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-medium text-foreground">캠퍼스/반</span>
              <span>
                {[campus, classNumber ? `${classNumber}반` : null]
                  .filter(Boolean)
                  .join(" · ") || "-"}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-medium text-foreground">가입일</span>
              <span>{formatDateTime(member.created_at)}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-medium text-foreground">수정일</span>
              <span>{formatDateTime(member.updated_at)}</span>
            </div>
          </div>
        </div>
      </div>

      <form action={updateAction} className="grid gap-3">
        <input type="hidden" name="id" value={member.id} />

        <label className="grid gap-2 text-sm font-medium text-foreground">
          표시 이름
          <Input
            name="displayName"
            defaultValue={displayName}
            placeholder="표시 이름"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-foreground">
          캠퍼스
          <Input name="campus" defaultValue={campus} placeholder="서울" />
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-foreground">
            반
            <Input
              type="number"
              min={1}
              max={30}
              name="classNumber"
              defaultValue={classNumber}
              placeholder="11"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-foreground">
            비밀번호 변경 강제
            <Select
              name="mustChangePassword"
              defaultValue={member.must_change_password ? "true" : "false"}
            >
              <option value="false">유지</option>
              <option value="true">강제</option>
            </Select>
          </label>
        </div>

        <p className="text-xs text-muted-foreground">
          MM 아이디는 인증 연동 기준값이라 여기서는 읽기 전용으로 유지합니다.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <SubmitButton variant="ghost" pendingText="저장 중">
            저장
          </SubmitButton>
        </div>
      </form>

      <form action={deleteAction} onSubmit={handleDeleteSubmit}>
        <input type="hidden" name="id" value={member.id} />
        <SubmitButton variant="danger" pendingText="삭제 중">
          회원 삭제
        </SubmitButton>
      </form>
    </Card>
  );
}
