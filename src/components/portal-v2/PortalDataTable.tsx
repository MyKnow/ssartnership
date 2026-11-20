import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import PortalPanel from "./PortalPanel";

export type PortalColumn<Row> = {
  id: string;
  header: string;
  cell: (row: Row) => ReactNode;
  /** 열 너비(`%` 권장). 헤더와 본문이 같은 `colgroup`을 써 시작점이 어긋나지 않는다. */
  width?: string;
  align?: "start" | "end";
  /** 모바일 카드에서 쓰는 라벨. 기본은 `header`. */
  mobileLabel?: string;
  /** 모바일 카드 첫 줄(행 제목)로 쓴다. 한 열만 지정한다. */
  primary?: boolean;
};

/**
 * 데이터 표. md 이상은 `table`(헤더 36/행 56), 모바일은 같은 데이터를
 * `dl` 카드 목록으로 바꿔 가로 스크롤 없이 모든 열을 보여 준다.
 * 행 이동·관리 같은 조작은 `actions` 열(`cell`)에 넣고 행 전체를 링크로 만들지 않는다.
 */
export default function PortalDataTable<Row>({
  caption,
  columns,
  rows,
  getRowKey,
  className,
}: {
  /** 스크린리더용 표 이름. 화면에는 보이지 않는다. */
  caption: string;
  columns: PortalColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => string;
  className?: string;
}) {
  const primary = columns.find((column) => column.primary);
  const rest = columns.filter((column) => column !== primary);

  return (
    <div className={cn("min-w-0", className)}>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-0 table-fixed border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <colgroup>
            {columns.map((column) => (
              <col key={column.id} style={column.width ? { width: column.width } : undefined} />
            ))}
          </colgroup>
          <thead>
            <tr className="h-9 bg-pv2-canvas">
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className={cn(
                    "px-3 align-middle pv2-caption font-normal text-pv2-muted",
                    column.align === "end" && "text-right",
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={getRowKey(row)} className="h-14 border-b border-pv2-border">
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={cn(
                      "min-w-0 px-3 py-2 align-middle pv2-body text-ko-pretty text-pv2-text",
                      column.primary && "pv2-label",
                      column.align === "end" && "text-right",
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <li key={getRowKey(row)} className="min-w-0 rounded-pv2-control border border-pv2-border p-4">
            {primary ? (
              <p className="mb-3 pv2-label text-ko-pretty text-pv2-text">{primary.cell(row)}</p>
            ) : null}
            <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-2">
              {rest.map((column) => (
                <div key={column.id} className="contents">
                  <dt className="pv2-caption text-pv2-muted">{column.mobileLabel ?? column.header}</dt>
                  <dd className="min-w-0 pv2-body text-ko-pretty text-pv2-text">{column.cell(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 표를 담는 패널. 제목·설명·액션은 `PortalPanel`과 같다. */
export function PortalTablePanel<Row>({
  title,
  description,
  actions,
  footer,
  ...table
}: Parameters<typeof PortalDataTable<Row>>[0] & {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <PortalPanel title={title} description={description} actions={actions}>
      <PortalDataTable {...table} />
      {footer}
    </PortalPanel>
  );
}
