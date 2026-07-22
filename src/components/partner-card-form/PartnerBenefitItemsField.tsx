"use client";

import { useMemo, useState } from "react";
import type { PartnerBenefit, PartnerBenefitDraft } from "@/lib/partner-benefit-items";

type EditorRow = {
  id: string;
  title: string;
  maxApplyCount: string;
};

function createId(index: number) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `benefit-editor-${index + 1}`;
}

function toRows(items: readonly PartnerBenefit[]) {
  return items.map((item, index) => ({
    id: item.id || createId(index),
    title: item.title,
    maxApplyCount: item.maxApplyCount == null ? "" : String(item.maxApplyCount),
  }));
}

export default function PartnerBenefitItemsField({
  initialItems,
  draftRestoreVersion = 0,
}: {
  initialItems: PartnerBenefit[];
  draftRestoreVersion?: number;
}) {
  const [rows, setRows] = useState<EditorRow[]>(() => toRows(initialItems));
  const serializedItems = useMemo(
    () => JSON.stringify(rows.map<PartnerBenefitDraft>((row, index) => ({
      id: row.id,
      title: row.title,
      maxApplyCount: row.maxApplyCount,
      displayOrder: index,
    }))),
    [rows],
  );
  const serializedTitles = rows.map((row) => row.title).filter(Boolean).join("\n");

  function updateRow(index: number, patch: Partial<EditorRow>) {
    setRows((current) => current.map((row, rowIndex) =>
      rowIndex === index ? { ...row, ...patch } : row,
    ));
  }

  function moveRow(index: number, direction: -1 | 1) {
    setRows((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [row] = next.splice(index, 1);
      if (row) next.splice(nextIndex, 0, row);
      return next;
    });
  }

  return (
    <div className="grid gap-3" key={draftRestoreVersion}>
      <input type="hidden" name="benefitItems" value={serializedItems} readOnly />
      <input type="hidden" name="benefits" value={serializedTitles} readOnly />
      {rows.map((row, index) => (
        <div key={row.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 rounded-2xl border border-border bg-surface-control p-3">
          <label className="grid min-w-0 gap-1 text-xs font-semibold text-muted-foreground">
            혜택명
            <input
              value={row.title}
              onChange={(event) => updateRow(index, { title: event.target.value })}
              placeholder="예: 헬스장 1개월 이용권"
              className="h-10 min-w-0 w-full rounded-xl border border-border bg-surface px-3 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>
          <div className="grid min-w-0 gap-2">
            <label className="grid min-w-0 gap-1 text-xs font-semibold text-muted-foreground">
              최대 적용 횟수
              <input
                value={row.maxApplyCount}
                onChange={(event) => updateRow(index, { maxApplyCount: event.target.value.replace(/\D/g, "") })}
                inputMode="numeric"
                min={1}
                placeholder="미입력 = 1회"
                className="h-10 min-w-0 w-full rounded-xl border border-border bg-surface px-3 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </label>
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-1">
              <button type="button" onClick={() => moveRow(index, -1)} disabled={index === 0} className="rounded-lg px-2 py-2 text-sm disabled:opacity-30" aria-label="혜택 위로 이동">↑</button>
              <button type="button" onClick={() => moveRow(index, 1)} disabled={index === rows.length - 1} className="rounded-lg px-2 py-2 text-sm disabled:opacity-30" aria-label="혜택 아래로 이동">↓</button>
              <button type="button" onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))} className="rounded-lg px-2 py-2 text-sm text-danger" aria-label="혜택 삭제">삭제</button>
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((current) => [...current, { id: createId(current.length), title: "", maxApplyCount: "" }])}
        className="min-h-10 rounded-xl border border-dashed border-primary/35 bg-primary-soft px-3 text-sm font-semibold text-primary"
      >
        + 혜택 추가
      </button>
      <p className="text-xs leading-5 text-muted-foreground">
        혜택별로 한 번에 적용할 횟수를 지정합니다. 비워 두면 1회로 적용됩니다. 과거 사용 횟수와는 합산하지 않습니다.
      </p>
    </div>
  );
}
