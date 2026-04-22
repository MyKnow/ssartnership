import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import SectionHeading from "@/components/ui/SectionHeading";
import { formatDateTime, getLogLabel } from "@/components/admin/logs/utils";

type PartnerAuditLog = {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  properties: Record<string, unknown> | null;
  created_at: string;
  actor_id: string | null;
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

type FieldChange = {
  label: string;
  beforeText?: string;
  afterText?: string;
};

function getFieldChanges(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is FieldChange =>
      Boolean(item) &&
      typeof item === "object" &&
      "label" in item,
  );
}

export default function AdminPartnerChangeHistory({
  logs,
}: {
  logs: PartnerAuditLog[];
}) {
  return (
    <div className="grid gap-5">
      <SectionHeading
        title="수정 이력"
        description="브랜드와 연결된 협력사 정보 수정 기록을 확인합니다."
      />

      {logs.length === 0 ? (
        <EmptyState
          title="수정 이력이 없습니다."
          description="아직 이 브랜드에 대한 수정 로그가 생성되지 않았습니다."
        />
      ) : (
        <div className="grid gap-4">
          {logs.map((log) => {
            const summary = getStringValue(log.properties?.summary) ?? getLogLabel("audit", log.action);
            const changedFields = getStringArray(log.properties?.changedFields);
            const changes = getStringArray(log.properties?.changes);
            const fieldChanges = getFieldChanges(log.properties?.fieldChanges);
            const rawProperties =
              log.properties && Object.keys(log.properties).length > 0
                ? JSON.stringify(log.properties, null, 2)
                : "";

            return (
              <Card key={log.id} tone="muted" padding="md" className="grid gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="primary">{getLogLabel("audit", log.action)}</Badge>
                  <Badge>{log.target_type ?? "unknown"}</Badge>
                  <span className="text-xs font-medium text-muted-foreground">
                    {formatDateTime(log.created_at)}
                  </span>
                </div>

                <div className="grid gap-2">
                  <p className="text-sm font-semibold text-foreground">{summary}</p>

                  {changedFields.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {changedFields.map((field) => (
                        <Badge key={field} className="bg-surface-elevated text-foreground">
                          {field}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>

                {changes.length > 0 ? (
                  <div className="grid gap-2 rounded-2xl border border-border/70 bg-surface-elevated px-4 py-3">
                    {changes.map((change) => (
                      <p key={change} className="text-sm leading-6 text-foreground">
                        {change}
                      </p>
                    ))}
                  </div>
                ) : null}

                {fieldChanges.length > 0 ? (
                  <div className="grid gap-2 rounded-2xl border border-border/70 bg-surface-inset px-4 py-3">
                    {fieldChanges.map((fieldChange) => (
                      <div key={fieldChange.label} className="grid gap-1">
                        <p className="text-sm font-semibold text-foreground">{fieldChange.label}</p>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {fieldChange.beforeText ?? "없음"} → {fieldChange.afterText ?? "없음"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>대상: {log.target_type ?? "-"} / {log.target_id ?? "-"}</span>
                  {log.actor_id ? <span>관리자: {log.actor_id}</span> : null}
                </div>

                {rawProperties ? (
                  <details className="rounded-2xl border border-border/70 bg-surface-inset px-4 py-3">
                    <summary className="cursor-pointer select-none text-sm font-semibold text-foreground">
                      원본 속성 보기
                    </summary>
                    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-muted-foreground">
                      {rawProperties}
                    </pre>
                  </details>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
