"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import SubmitButton from "@/components/ui/SubmitButton";
import Textarea from "@/components/ui/Textarea";
import {
  MANUAL_MEMBER_ADD_INITIAL_STATE,
  type ManualMemberAddFormState,
  type ManualMemberAddYear,
} from "@/lib/member-manual-add";
import { formatSsafyYearLabel } from "@/lib/ssafy-year";

const YEAR_OPTIONS: ManualMemberAddYear[] = [0, 14, 15];

function getItemStatusClass(status: "success" | "failed") {
  return status === "success"
    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    : "bg-danger/15 text-danger";
}

function getRequestedYearLabel(year: number) {
  return formatSsafyYearLabel(year);
}

export default function AdminMemberManualAddPanel({
  action,
}: {
  action: (
    prevState: ManualMemberAddFormState,
    formData: FormData,
  ) => Promise<ManualMemberAddFormState>;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    action,
    MANUAL_MEMBER_ADD_INITIAL_STATE,
  );
  const refreshKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (state.status === "idle" || state.total === 0) {
      return;
    }
    const refreshKey = `${state.status}:${state.total}:${state.success}:${state.failed}`;
    if (refreshKeyRef.current === refreshKey) {
      return;
    }
    refreshKeyRef.current = refreshKey;
    router.refresh();
  }, [router, state.failed, state.status, state.success, state.total]);

  return (
    <div className="grid gap-4">
      <form action={formAction} className="grid gap-4 rounded-3xl border border-border bg-surface p-4 shadow-[var(--shadow-flat)]">
        <div className="grid gap-3 lg:grid-cols-[160px_minmax(0,1fr)] lg:items-end">
          <label className="grid gap-2 text-sm font-medium text-foreground">
            대상 기수
            <Select name="requestedYear" defaultValue="15">
              {YEAR_OPTIONS.map((year) => (
                <option key={year} value={String(year)}>
                  {formatSsafyYearLabel(year)}
                </option>
              ))}
            </Select>
          </label>

          <div className="grid gap-2 text-sm text-muted-foreground">
            <span>운영진은 15기에서 먼저 찾고, 없으면 14기에서 찾아 임시 비밀번호를 보냅니다.</span>
            <span>입력 형식은 콤마 구분이며, 줄바꿈도 함께 지원합니다.</span>
          </div>
        </div>

        <label className="grid gap-2 text-sm font-medium text-foreground">
          MM ID 리스트
          <Textarea
            name="mmIds"
            rows={4}
            placeholder="mmid-one, mmid-two, mmid-three"
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            추가 시 각 유저에게 임시 비밀번호를 전송하고, 비밀번호 변경을 필수로 지정합니다.
          </p>
          <SubmitButton pendingText="추가 중">추가 및 전송</SubmitButton>
        </div>
      </form>

      {state.status !== "idle" ? (
        <div className="grid gap-4 rounded-3xl border border-border bg-surface-elevated p-4 shadow-[var(--shadow-flat)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-foreground">추가 결과</h3>
                <Badge
                  className={
                    state.status === "success"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : state.status === "partial"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        : "bg-danger/15 text-danger"
                  }
                >
                  {state.status === "success"
                    ? "완료"
                    : state.status === "partial"
                      ? "부분 완료"
                      : "실패"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {state.message ?? "결과를 확인해 주세요."}
              </p>
            </div>
            <Button variant="ghost" href="/admin/logs">
              로그 조회
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-surface-inset px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">대상</p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {getRequestedYearLabel(state.requestedYear)}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-surface-inset px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">성공</p>
              <p className="mt-1 text-lg font-semibold text-emerald-600 dark:text-emerald-300">
                {state.success}명
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-surface-inset px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">실패</p>
              <p className="mt-1 text-lg font-semibold text-danger">
                {state.failed}명
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            {state.items.map((item) => (
              <div
                key={`${item.username}-${item.raw}`}
                className="rounded-2xl border border-border bg-surface-inset px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={getItemStatusClass(item.status)}>
                    {item.status === "success" ? "성공" : "실패"}
                  </Badge>
                  <span className="font-medium text-foreground">@{item.username}</span>
                  <Badge className="bg-surface-muted text-muted-foreground">
                    {getRequestedYearLabel(item.requestedYear)}
                  </Badge>
                  {item.resolvedYear !== null ? (
                    <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300">
                      조회 {formatSsafyYearLabel(item.resolvedYear)}
                    </Badge>
                  ) : null}
                  {item.staffSourceYear !== null ? (
                    <Badge className="bg-violet-500/15 text-violet-700 dark:text-violet-300">
                      운영진 기수 {formatSsafyYearLabel(item.staffSourceYear)}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.status === "success" ? (
                    <>
                      {item.action === "created" ? "신규 추가" : "기존 회원 갱신"}
                      {item.displayName ? ` · ${item.displayName}` : ""}
                      {item.campus ? ` · ${item.campus}` : ""}
                    </>
                  ) : (
                    item.reason ?? "처리 실패"
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
