import { ChevronDownIcon } from "@heroicons/react/24/outline";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import SectionHeading from "@/components/ui/SectionHeading";
import { buildPartnerChangeRequestDiffItems } from "@/components/partner-change-request-ui/buildDiffItems";
import { cn } from "@/lib/cn";
import { formatDateTime, getLogLabel } from "@/components/admin/logs/utils";
import type { PartnerChangeRequestSummary } from "@/lib/partner-change-requests";

type PartnerAuditLog = {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  properties: Record<string, unknown> | null;
  created_at: string;
  actor_id: string | null;
};

type DiffRow = {
  label: string;
  beforeText: string;
  afterText: string;
};

function getStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => String(item).trim())
    .filter(Boolean);
}

function getStringValue(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getDiffRows(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is DiffRow => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const candidate = item as Partial<DiffRow> & Record<string, unknown>;
    return (
      typeof candidate.label === "string" &&
      typeof candidate.beforeText === "string" &&
      typeof candidate.afterText === "string"
    );
  });
}

function parseLegacyDiffRow(value: string) {
  const separatorIndex = value.indexOf(": ");
  if (separatorIndex === -1) {
    return null;
  }

  const label = value.slice(0, separatorIndex).trim();
  const remainder = value.slice(separatorIndex + 2).trim();
  const arrowIndex = remainder.indexOf(" → ");
  if (arrowIndex === -1) {
    return null;
  }

  const beforeText = remainder.slice(0, arrowIndex).trim();
  const afterText = remainder.slice(arrowIndex + 3).trim();
  return {
    label,
    beforeText: beforeText || "없음",
    afterText: afterText || "없음",
  };
}

function getLegacyDiffRows(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? parseLegacyDiffRow(item) : null))
    .filter((item): item is DiffRow => Boolean(item));
}

function getDisplayDiffRows(log: PartnerAuditLog) {
  const structuredRows = getDiffRows(log.properties?.fieldChanges);
  if (structuredRows.length > 0) {
    return structuredRows;
  }

  const legacyRows = getLegacyDiffRows(log.properties?.changes);
  if (legacyRows.length > 0) {
    return legacyRows;
  }

  return [];
}

function getTargetSummary(log: PartnerAuditLog) {
  const parts = [log.target_type ?? "-", log.target_id ?? "-"];
  return parts.join(" / ");
}

function getChangeCountLabel(rows: DiffRow[], changedFields: string[]) {
  if (rows.length > 0) {
    return `${rows.length}개 변경`;
  }
  if (changedFields.length > 0) {
    return `${changedFields.length}개 변경`;
  }
  return "변경 없음";
}

const requestStatusLabel: Record<PartnerChangeRequestSummary["status"], string> = {
  pending: "승인 대기",
  approved: "승인됨",
  rejected: "반려됨",
  cancelled: "취소됨",
};

export default function AdminPartnerChangeHistory({
  logs,
  requests = [],
}: {
  logs: PartnerAuditLog[];
  requests?: PartnerChangeRequestSummary[];
}) {
  const hasHistory = logs.length > 0 || requests.length > 0;

  return (
    <Card tone="default" className="grid gap-5">
      <SectionHeading
        title="수정 이력"
        description="관리자 수정, 파트너 계정 수정 요청, 승인/반려 기록을 함께 확인합니다."
      />

      {!hasHistory ? (
        <EmptyState
          title="수정 이력이 없습니다."
          description="아직 이 브랜드에 대한 수정 로그가 생성되지 않았습니다."
        />
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => {
            const diffItems = buildPartnerChangeRequestDiffItems(request);
            const requester =
              request.requestedByDisplayName ??
              request.requestedByLoginId ??
              "파트너 계정";

            return (
              <details
                key={`request-${request.id}`}
                className="group rounded-panel border border-border/70 bg-surface-elevated shadow-raised"
              >
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-4 outline-none transition hover:bg-surface/50 focus-visible:bg-surface/50 [&::-webkit-details-marker]:hidden">
                  <div className="grid min-w-0 gap-3 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="primary">파트너 요청</Badge>
                      <Badge>{requestStatusLabel[request.status]}</Badge>
                      <Badge>{diffItems.length > 0 ? `${diffItems.length}개 변경` : "변경 없음"}</Badge>
                      <span className="text-xs font-medium text-muted-foreground">
                        {formatDateTime(request.createdAt)}
                      </span>
                    </div>

                    <div className="grid gap-1">
                      <p className="text-sm font-semibold text-foreground">
                        {request.requestedPartnerName} 변경 요청
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {request.companyName} · {requester}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground">
                    <span className="hidden sm:inline">펼치기</span>
                    <ChevronDownIcon
                      className={cn(
                        "h-5 w-5 transition-transform duration-200",
                        "group-open:rotate-180",
                      )}
                      aria-hidden="true"
                    />
                  </div>
                </summary>

                <div className="grid gap-4 border-t border-border/70 bg-surface px-4 py-4">
                  {diffItems.length > 0 ? (
                    <div className="grid gap-3">
                      {diffItems.map((change) => (
                        <div
                          key={change.key}
                          className="grid gap-3 rounded-2xl border border-border/70 bg-surface-inset p-4 shadow-none md:grid-cols-2"
                        >
                          <div className="grid gap-2">
                            <Badge variant="danger" className="w-fit">
                              {change.label} · 현재
                            </Badge>
                            <div className="text-sm leading-6 text-danger">
                              {change.current}
                            </div>
                          </div>
                          <div className="grid gap-2">
                            <Badge variant="success" className="w-fit">
                              {change.label} · 요청
                            </Badge>
                            <div className="text-sm leading-6 text-success">
                              {change.requested}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="변경된 필드가 없습니다."
                      description="이 요청은 실제 변경 diff가 없거나 즉시 반영 항목만 포함합니다."
                    />
                  )}
                </div>
              </details>
            );
          })}

          {logs.map((log) => {
            const summary = getStringValue(log.properties?.summary) ?? getLogLabel("audit", log.action);
            const changedFields = getStringArray(log.properties?.changedFields);
            const diffRows = getDisplayDiffRows(log);
            const rawProperties =
              log.properties && Object.keys(log.properties).length > 0
                ? JSON.stringify(log.properties, null, 2)
                : "";

            return (
              <details key={log.id} className="group rounded-panel border border-border/70 bg-surface-elevated shadow-raised">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-4 outline-none transition hover:bg-surface/50 focus-visible:bg-surface/50 [&::-webkit-details-marker]:hidden">
                  <div className="grid min-w-0 gap-3 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="primary">{getLogLabel("audit", log.action)}</Badge>
                      <Badge>{getChangeCountLabel(diffRows, changedFields)}</Badge>
                      <Badge>{log.target_type ?? "unknown"}</Badge>
                      <span className="text-xs font-medium text-muted-foreground">
                        {formatDateTime(log.created_at)}
                      </span>
                    </div>

                    <div className="grid gap-1">
                      <p className="text-sm font-semibold text-foreground">{summary}</p>
                      <p className="text-xs text-muted-foreground">
                        {getTargetSummary(log)}
                        {log.actor_id ? ` · 관리자 ${log.actor_id}` : ""}
                      </p>
                    </div>

                    {changedFields.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {changedFields.slice(0, 4).map((field) => (
                          <Badge key={field} className="bg-surface-elevated text-foreground">
                            {field}
                          </Badge>
                        ))}
                        {changedFields.length > 4 ? (
                          <Badge className="bg-surface-elevated text-foreground">
                            +{changedFields.length - 4}
                          </Badge>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground">
                    <span className="hidden sm:inline">펼치기</span>
                    <ChevronDownIcon
                      className={cn(
                        "h-5 w-5 transition-transform duration-200",
                        "group-open:rotate-180",
                      )}
                      aria-hidden="true"
                    />
                  </div>
                </summary>

                <div className="grid gap-4 border-t border-border/70 bg-surface px-4 py-4">
                  {diffRows.length > 0 ? (
                    <div className="grid gap-3">
                      {diffRows.map((change) => (
                        <div
                          key={change.label}
                          className="grid gap-3 rounded-2xl border border-border/70 bg-surface-inset p-4 shadow-none md:grid-cols-2"
                        >
                          <div className="grid gap-1">
                            <Badge variant="danger" className="w-fit">
                              {change.label} · 이전
                            </Badge>
                            <p className="text-sm leading-6 text-danger">
                              {change.beforeText || "없음"}
                            </p>
                          </div>
                          <div className="grid gap-1">
                            <Badge variant="success" className="w-fit">
                              {change.label} · 이후
                            </Badge>
                            <p className="text-sm leading-6 text-success">
                              {change.afterText || "없음"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="변경된 필드가 없습니다."
                      description="이 로그는 변경 요약만 있고 필드별 diff가 저장되지 않았습니다."
                    />
                  )}

                  {rawProperties ? (
                    <details className="rounded-2xl border border-border/70 bg-surface-inset px-4 py-3 shadow-none">
                      <summary className="cursor-pointer select-none text-sm font-semibold text-foreground">
                        원본 로그 보기
                      </summary>
                      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-muted-foreground">
                        {rawProperties}
                      </pre>
                    </details>
                  ) : null}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </Card>
  );
}
