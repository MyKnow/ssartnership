"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { NormalizedLog } from "./types";
import { formatDateTime, getPropertyEntries } from "./utils";

type LogDetailResponse = {
  properties: Record<string, unknown> | null;
};

export default function AdminLogDetailDisclosure({
  log,
  includePii,
}: {
  log: NormalizedLog;
  includePii: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [properties, setProperties] = useState(log.properties);
  const [detailState, setDetailState] = useState<
    "idle" | "loading" | "loaded" | "error"
  >(log.properties ? "loaded" : "idle");
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    if (!isOpen || !includePii || properties) {
      return;
    }

    const controller = new AbortController();
    void fetch(
      `/api/admin/logs/${encodeURIComponent(log.group)}/${encodeURIComponent(log.id)}`,
      {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | LogDetailResponse
          | null;
        return response.ok && payload && "properties" in payload
          ? payload.properties
          : null;
      })
      .then((nextProperties) => {
        if (controller.signal.aborted) {
          return;
        }
        setProperties(nextProperties);
        setDetailState("loaded");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setDetailState("error");
        }
      });

    return () => controller.abort();
  }, [includePii, isOpen, log.group, log.id, properties, requestKey]);

  const propertyEntries = includePii
    ? getPropertyEntries(properties).slice(0, 8)
    : [];

  return (
    <details
      open={isOpen}
      onToggle={(event) => {
        const open = event.currentTarget.open;
        setIsOpen(open);
        if (open && !properties && includePii) {
          setDetailState("loading");
        }
      }}
      className="mt-4 rounded-2xl border border-border bg-surface-inset px-4 py-3"
    >
      <summary className="cursor-pointer select-none text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2">
        상세 보기
      </summary>
      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="grid gap-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between gap-3">
            <span>그룹</span>
            <span className="font-medium text-foreground">{log.group}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>이벤트</span>
            <span className="max-w-full text-token font-medium text-foreground">
              {log.name}
            </span>
          </div>
          {includePii ? (
            <div className="flex items-center justify-between gap-3">
              <span>주체</span>
              <span className="max-w-full text-token text-right font-medium text-foreground">
                {log.actorType === "member" && log.actorId ? (
                  <Link
                    href={`/admin/members/${log.actorId}`}
                    target="_blank"
                    rel="noreferrer"
                    prefetch={false}
                    className="text-primary hover:underline"
                  >
                    {log.actorSearchLabel}
                  </Link>
                ) : (
                  log.actorSearchLabel
                )}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <span>상태</span>
            <span className="font-medium text-foreground">
              {log.status ?? "-"}
            </span>
          </div>
          {includePii ? (
            <div className="flex items-center justify-between gap-3">
              <span>경로</span>
              <span className="max-w-full text-token font-medium text-foreground">
                {log.path ?? "-"}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <span>대상</span>
            <span className="max-w-full text-token font-medium text-foreground">
              {log.targetType ?? "-"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>대상 ID</span>
            <span className="max-w-full text-token font-medium text-foreground">
              {includePii ? log.targetId ?? "-" : "-"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>제휴처</span>
            <span className="max-w-full text-token text-right font-medium text-foreground">
              {log.partnerId && log.partnerName ? (
                <Link
                  href={`/admin/partners/${log.partnerId}`}
                  target="_blank"
                  rel="noreferrer"
                  prefetch={false}
                  className="text-primary hover:underline"
                >
                  {log.partnerName}
                </Link>
              ) : (
                "-"
              )}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>생성 시각</span>
            <span className="font-medium text-foreground">
              {formatDateTime(log.createdAt)}
            </span>
          </div>
        </div>
        {includePii ? (
          <div className="rounded-2xl border border-border bg-surface-muted p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              properties
            </p>
            {detailState === "loading" ? (
              <p className="mt-2 text-sm text-muted-foreground" role="status">
                상세 속성을 불러오는 중입니다.
              </p>
            ) : detailState === "error" ? (
              <div className="mt-2 grid gap-2">
                <p className="text-sm text-muted-foreground">
                  상세 속성을 불러오지 못했습니다.
                </p>
                <button
                  type="button"
                  className="min-h-11 w-fit rounded-control border border-border px-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  onClick={() => {
                    setDetailState("loading");
                    setRequestKey((current) => current + 1);
                  }}
                >
                  다시 불러오기
                </button>
              </div>
            ) : propertyEntries.length > 0 ? (
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-5 text-foreground">
                {JSON.stringify(properties ?? {}, null, 2)}
              </pre>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                기록된 상세 속성이 없습니다.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </details>
  );
}
