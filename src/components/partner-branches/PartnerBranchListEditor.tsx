"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import {
  ArrowDownTrayIcon,
  DocumentArrowUpIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import {
  DEFAULT_PARTNER_BENEFIT_GROUP_KEY,
  createPartnerBenefitGroupCode,
  getPartnerBranchScopeLabel,
  normalizeBenefitGroupKey,
} from "@/lib/partner-branch-registration";

export type BranchEditorRow = {
  id: string;
  benefitGroupKey: string;
  branchName: string;
  address: string;
  branchCode: string;
  branchType: "direct" | "franchise" | "unknown";
  mapUrl: string;
  phone: string;
  memo: string;
};

const branchTypeOptions = [
  { value: "direct", label: "직영" },
  { value: "franchise", label: "가맹" },
  { value: "unknown", label: "미정" },
] as const satisfies Array<{ value: BranchEditorRow["branchType"]; label: string }>;

type ExcelCellLike = {
  text?: string;
  value?: unknown;
};

type ExcelRowLike = {
  eachCell: (callback: (cell: ExcelCellLike, columnNumber: number) => void) => void;
};

type ExcelWorksheetLike = {
  getRow: (rowNumber: number) => ExcelRowLike;
  eachRow: (callback: (row: ExcelRowLike, rowNumber: number) => void) => void;
};

function createBranchEditorRowId() {
  return `branch-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeEditorBenefitGroupKey(value?: string | null) {
  return normalizeBenefitGroupKey(value, DEFAULT_PARTNER_BENEFIT_GROUP_KEY);
}

function normalizeHeader(value: string) {
  return value.replace(/\s+/g, "").trim();
}

function getCellText(cell: ExcelCellLike) {
  const text = cell.text?.trim();
  if (text) {
    return text;
  }
  const value = cell.value;
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    const maybeValue = value as { result?: unknown; text?: unknown; hyperlink?: unknown };
    if (maybeValue.text !== undefined) {
      return String(maybeValue.text).trim();
    }
    if (maybeValue.result !== undefined) {
      return String(maybeValue.result).trim();
    }
    if (maybeValue.hyperlink !== undefined) {
      return String(maybeValue.hyperlink).trim();
    }
  }
  return String(value).trim();
}

function normalizeEditorBranchType(value?: string | null): BranchEditorRow["branchType"] {
  const normalized = (value ?? "").trim().toLowerCase();
  if (["franchise", "가맹", "가맹점"].includes(normalized)) {
    return "franchise";
  }
  if (["unknown", "미정", "혼합"].includes(normalized)) {
    return "unknown";
  }
  return "direct";
}

function splitBranchListLine(line: string) {
  if (line.includes("\t")) {
    return line.split("\t");
  }
  if (line.includes("|")) {
    return line.split("|");
  }
  return line.split(",");
}

function deriveBenefitGroupCodes(rows: BranchEditorRow[]) {
  return Array.from(
    new Set([
      DEFAULT_PARTNER_BENEFIT_GROUP_KEY,
      ...rows.map((row) => normalizeEditorBenefitGroupKey(row.benefitGroupKey)),
    ]),
  ).sort((left, right) => left.localeCompare(right, "ko"));
}

function getNextBenefitGroupCode(codes: string[]) {
  const maxCodeNumber = codes.reduce((maxValue, code) => {
    const match = code.match(/^G(\d+)$/i);
    if (!match) {
      return maxValue;
    }
    return Math.max(maxValue, Number.parseInt(match[1]!, 10));
  }, 0);
  return createPartnerBenefitGroupCode(maxCodeNumber);
}

export function createEmptyBranchEditorRow(
  id: string,
  benefitGroupKey = DEFAULT_PARTNER_BENEFIT_GROUP_KEY,
): BranchEditorRow {
  return {
    id,
    benefitGroupKey: normalizeEditorBenefitGroupKey(benefitGroupKey),
    branchName: "",
    address: "",
    branchCode: "",
    branchType: "direct",
    mapUrl: "",
    phone: "",
    memo: "",
  };
}

export function parseInitialBranchEditorRows(value?: string) {
  const rows = (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index): BranchEditorRow => {
      const cells = splitBranchListLine(line).map((cell) => cell.trim());
      if (cells.length === 1) {
        return {
          ...createEmptyBranchEditorRow(`initial-${index}`),
          address: cells[0] ?? "",
        };
      }
      if (cells.length === 2) {
        return {
          ...createEmptyBranchEditorRow(`initial-${index}`),
          branchName: cells[0] ?? "",
          address: cells[1] ?? "",
        };
      }
      return {
        id: `initial-${index}`,
        benefitGroupKey: normalizeEditorBenefitGroupKey(cells[0]),
        branchName: cells[1] ?? "",
        address: cells[2] ?? "",
        branchCode: cells[3] ?? "",
        branchType: normalizeEditorBranchType(cells[4]),
        mapUrl: cells[5] ?? "",
        phone: cells[6] ?? "",
        memo: cells.slice(7).join(" "),
      };
    });
  return rows.length > 0 ? rows : [createEmptyBranchEditorRow("initial-0")];
}

function trimBranchRow(row: BranchEditorRow) {
  return {
    ...row,
    benefitGroupKey: normalizeEditorBenefitGroupKey(row.benefitGroupKey),
    branchName: row.branchName.trim(),
    address: row.address.trim(),
    branchCode: row.branchCode.trim(),
    mapUrl: row.mapUrl.trim(),
    phone: row.phone.trim(),
    memo: row.memo.trim(),
  };
}

export function branchRowHasValue(row: BranchEditorRow) {
  const trimmed = trimBranchRow(row);
  return Boolean(
    trimmed.branchName ||
      trimmed.address ||
      trimmed.branchCode ||
      trimmed.mapUrl ||
      trimmed.phone ||
      trimmed.memo,
  );
}

export function serializeBranchRows(rows: BranchEditorRow[]) {
  return rows
    .map(trimBranchRow)
    .filter(branchRowHasValue)
    .map((row) =>
      [
        row.benefitGroupKey || DEFAULT_PARTNER_BENEFIT_GROUP_KEY,
        row.branchName,
        row.address,
        row.branchCode,
        row.branchType,
        row.mapUrl,
        row.phone,
        row.memo,
      ].join("\t"),
    )
    .join("\n");
}

async function parseBranchXlsxFile(file: File) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(
    buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  const worksheet = workbook.worksheets[0] as ExcelWorksheetLike | undefined;
  if (!worksheet) {
    throw new Error("지점 목록 시트를 찾지 못했습니다.");
  }

  const headerByColumn = new Map<number, string>();
  worksheet.getRow(1).eachCell((cell, columnNumber) => {
    const header = normalizeHeader(getCellText(cell));
    if (header) {
      headerByColumn.set(columnNumber, header);
    }
  });

  const rows: BranchEditorRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }
    const rowValues = new Map<string, string>();
    row.eachCell((cell, columnNumber) => {
      const header = headerByColumn.get(columnNumber);
      if (!header) {
        return;
      }
      rowValues.set(header, getCellText(cell));
    });
    const hasAnyValue = Array.from(rowValues.values()).some(Boolean);
    if (!hasAnyValue) {
      return;
    }
    rows.push({
      id: `xlsx-${rowNumber}-${Math.random().toString(36).slice(2, 8)}`,
      benefitGroupKey: normalizeEditorBenefitGroupKey(rowValues.get("혜택그룹")),
      branchName: rowValues.get("지점명") ?? "",
      address: rowValues.get("주소") ?? "",
      branchCode: rowValues.get("지점코드") ?? "",
      branchType: normalizeEditorBranchType(
        rowValues.get("직영/가맹") ?? rowValues.get("지점유형"),
      ),
      mapUrl: rowValues.get("지도URL") ?? "",
      phone: rowValues.get("전화번호") ?? "",
      memo: rowValues.get("메모") ?? rowValues.get("운영메모") ?? "",
    });
  });

  if (rows.length === 0) {
    throw new Error("불러올 지점 행이 없습니다.");
  }
  return rows;
}

export default function PartnerBranchListEditor({
  rows,
  error,
  serializedValue,
  inferredScopeType,
  onChange,
  inputRef,
  inputName = "branchListText",
  fileInputName = "branchListFile",
  templateHref = "/partner-registration/branches/template",
  title = "적용 지점 목록",
  description = "여러 지점은 행을 추가하거나 XLSX 파일로 한 번에 채웁니다.",
  showScopeSummary = true,
  className,
}: {
  rows: BranchEditorRow[];
  error?: string;
  serializedValue: string;
  inferredScopeType?: string;
  onChange: (rows: BranchEditorRow[]) => void;
  inputRef?: (element: HTMLElement | null) => void;
  inputName?: string;
  fileInputName?: string;
  templateHref?: string;
  title?: string;
  description?: string;
  showScopeSummary?: boolean;
  className?: string;
}) {
  const [extraBenefitGroupCodes, setExtraBenefitGroupCodes] = useState<string[]>([]);
  const [xlsxMessage, setXlsxMessage] = useState<string | null>(null);
  const [xlsxError, setXlsxError] = useState<string | null>(null);
  const filledRows = rows.filter(branchRowHasValue);
  const derivedCodes = useMemo(() => deriveBenefitGroupCodes(rows), [rows]);
  const benefitGroupCodes = useMemo(
    () =>
      Array.from(new Set([...derivedCodes, ...extraBenefitGroupCodes])).sort((left, right) =>
        left.localeCompare(right, "ko"),
      ),
    [derivedCodes, extraBenefitGroupCodes],
  );

  const updateRow = (
    rowId: string,
    key: keyof Omit<BranchEditorRow, "id">,
    value: string,
  ) => {
    onChange(
      rows.map((row) => (row.id === rowId ? { ...row, [key]: value } : row)),
    );
  };

  const addRow = (benefitGroupKey = DEFAULT_PARTNER_BENEFIT_GROUP_KEY) => {
    onChange([...rows, createEmptyBranchEditorRow(createBranchEditorRowId(), benefitGroupKey)]);
  };

  const removeRow = (rowId: string) => {
    const nextRows = rows.filter((row) => row.id !== rowId);
    onChange(
      nextRows.length > 0
        ? nextRows
        : [createEmptyBranchEditorRow(createBranchEditorRowId())],
    );
  };

  const addBenefitGroup = () => {
    const nextCode = getNextBenefitGroupCode(benefitGroupCodes);
    setExtraBenefitGroupCodes((current) => [...current, nextCode]);
    addRow(nextCode);
  };

  const handleXlsxUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0] ?? null;
    if (!file) {
      return;
    }
    setXlsxMessage(null);
    setXlsxError(null);
    if (file.size > 1024 * 1024) {
      setXlsxError("지점 XLSX 파일은 1MB 이하만 업로드할 수 있습니다.");
      return;
    }
    try {
      const parsedRows = await parseBranchXlsxFile(file);
      onChange(parsedRows);
      setExtraBenefitGroupCodes([]);
      setXlsxMessage(`${parsedRows.length.toLocaleString()}개 지점을 리스트에 채웠습니다.`);
      input.value = "";
    } catch (uploadError) {
      setXlsxError(
        uploadError instanceof Error
          ? uploadError.message
          : "XLSX 파일을 읽지 못했습니다.",
      );
    }
  };

  return (
    <section
      ref={inputRef}
      tabIndex={-1}
      className={cn(
        "grid min-w-0 gap-4 rounded-[1rem] border border-border/70 bg-surface-inset p-4 focus:outline-none",
        className,
      )}
    >
      <input type="hidden" name={inputName} value={serializedValue} />

      <div className="grid min-w-0 gap-3 rounded-[0.9rem] border border-primary/15 bg-primary-soft p-3">
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-primary">
              엑셀 양식으로 빠르게 채우기
            </p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-primary/80">
              양식을 내려받아 채운 뒤 업로드하면 아래 리스트가 자동으로 채워집니다.
            </p>
          </div>
          <Button
            href={templateHref}
            variant="primary"
            className="w-full lg:w-auto"
            prefetch={false}
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            양식 다운로드
          </Button>
        </div>
        <label className="grid min-w-0 gap-2" htmlFor={`${fileInputName}-xlsx-helper`}>
          <span className="ui-caption inline-flex min-w-0 items-center gap-1.5 text-primary">
            <DocumentArrowUpIcon className="h-4 w-4" />
            <span className="truncate">채운 파일 업로드</span>
          </span>
          <Input
            id={`${fileInputName}-xlsx-helper`}
            name={fileInputName}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleXlsxUpload}
            aria-invalid={Boolean(xlsxError) || undefined}
          />
          {xlsxMessage ? (
            <span className="text-xs font-semibold leading-5 text-primary">
              {xlsxMessage}
            </span>
          ) : null}
          {xlsxError ? (
            <span className="text-xs font-medium leading-5 text-danger" role="alert">
              {xlsxError}
            </span>
          ) : null}
        </label>
      </div>

      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-start">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        {showScopeSummary && inferredScopeType ? (
          <div className="rounded-[0.9rem] border border-primary/15 bg-primary-soft px-3 py-2 text-xs leading-5 text-primary">
            자동 판단: {getPartnerBranchScopeLabel(inferredScopeType)}
          </div>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {benefitGroupCodes.map((code) => (
          <span
            key={code}
            className="inline-flex h-8 items-center rounded-full border border-border bg-surface px-3 text-xs font-semibold text-foreground"
          >
            {code}
          </span>
        ))}
        <Button type="button" variant="soft" size="sm" onClick={addBenefitGroup}>
          <PlusIcon className="h-4 w-4" />
          그룹 추가
        </Button>
      </div>

      <div className="grid min-w-0 gap-3">
        {rows.map((row, index) => (
          <div
            key={row.id}
            className="grid min-w-0 gap-3 rounded-[1rem] border border-border bg-surface px-3 py-3"
          >
            <div className="flex min-w-0 items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold text-foreground">
                지점 {index + 1}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                ariaLabel={`지점 ${index + 1} 삭제`}
                disabled={rows.length === 1 && !branchRowHasValue(row)}
                onClick={() => removeRow(row.id)}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
              <Input
                value={row.branchName}
                onChange={(event) =>
                  updateRow(row.id, "branchName", event.currentTarget.value)
                }
                placeholder="지점명 예: 역삼본점"
                aria-label={`지점 ${index + 1} 이름`}
              />
              <Input
                value={row.address}
                onChange={(event) =>
                  updateRow(row.id, "address", event.currentTarget.value)
                }
                placeholder="주소 예: 서울 강남구 테헤란로 212"
                aria-label={`지점 ${index + 1} 주소`}
              />
            </div>
            <div className="grid min-w-0 gap-3 md:grid-cols-[8rem_10rem_minmax(0,1fr)]">
              <select
                value={row.benefitGroupKey}
                onChange={(event) =>
                  updateRow(row.id, "benefitGroupKey", event.currentTarget.value)
                }
                aria-label={`지점 ${index + 1} 혜택 그룹`}
                className="h-11 rounded-[1rem] border border-border bg-surface-control px-3 text-sm font-semibold text-foreground shadow-flat focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              >
                {benefitGroupCodes.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
              <select
                value={row.branchType}
                onChange={(event) =>
                  updateRow(row.id, "branchType", event.currentTarget.value)
                }
                aria-label={`지점 ${index + 1} 직영 또는 가맹`}
                className="h-11 rounded-[1rem] border border-border bg-surface-control px-3 text-sm font-semibold text-foreground shadow-flat focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              >
                {branchTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Input
                value={row.branchCode}
                onChange={(event) =>
                  updateRow(row.id, "branchCode", event.currentTarget.value)
                }
                placeholder="지점 코드 선택"
                aria-label={`지점 ${index + 1} 코드`}
              />
            </div>
            <details className="group rounded-[0.9rem] border border-border/70 bg-surface-muted px-3 py-2">
              <summary className="cursor-pointer select-none text-xs font-semibold text-muted-foreground">
                선택 정보
              </summary>
              <div className="mt-3 grid min-w-0 gap-3 md:grid-cols-3">
                <Input
                  value={row.mapUrl}
                  onChange={(event) =>
                    updateRow(row.id, "mapUrl", event.currentTarget.value)
                  }
                  placeholder="지도 URL"
                  aria-label={`지점 ${index + 1} 지도 URL`}
                />
                <Input
                  value={row.phone}
                  onChange={(event) =>
                    updateRow(row.id, "phone", event.currentTarget.value)
                  }
                  placeholder="전화번호"
                  aria-label={`지점 ${index + 1} 전화번호`}
                />
                <Input
                  value={row.memo}
                  onChange={(event) =>
                    updateRow(row.id, "memo", event.currentTarget.value)
                  }
                  placeholder="메모"
                  aria-label={`지점 ${index + 1} 메모`}
                />
              </div>
            </details>
          </div>
        ))}
      </div>

      {error ? (
        <span className="text-xs font-medium leading-5 text-danger" role="alert">
          {error}
        </span>
      ) : null}

      <div className="flex min-w-0 flex-col gap-2 border-t border-border/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-muted-foreground">
          입력된 지점 {filledRows.length.toLocaleString()}개
        </p>
        <Button type="button" variant="soft" size="sm" onClick={() => addRow()}>
          <PlusIcon className="h-4 w-4" />
          지점 추가
        </Button>
      </div>
    </section>
  );
}
