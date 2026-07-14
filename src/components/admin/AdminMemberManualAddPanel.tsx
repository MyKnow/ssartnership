"use client";

import JSZip from "jszip";
import { useMemo, useRef, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import {
  addManualMemberImportEditableRow,
  appendManualMemberImportWorkbookRows,
  toManualMemberImportRawRows,
  type ManualMemberImportEditableRow,
} from "@/lib/member-manual-import/rows";
import {
  MANUAL_MEMBER_IMPORT_IMAGE_CONTENT_TYPES,
  MANUAL_MEMBER_IMPORT_LIMITS,
  isManualMemberImportSafeFilename,
  validateManualMemberImportPhotoManifest,
  validateManualMemberImportRows,
} from "@/lib/member-manual-import/shared";

type PhotoEntry = {
  filename: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  file: File;
};

type PreflightSuccess = {
  ok: true;
  batchId: string;
  expiresAt: string;
  uploads: Array<{ rowNumber: number; filename: string; signedUrl: string }>;
};

type ImportResult = {
  total: number;
  success: number;
  failed: number;
  items: Array<{
    rowNumber: number;
    status: "success" | "failed";
    name: string | null;
    mmId: string | null;
    email: string | null;
    deliveryChannel: "mattermost" | "email" | null;
    reason: string | null;
  }>;
};

type AdminMemberManualAddPanelProps = {
  currentGeneration?: number;
  mmLookupGenerations?: readonly number[];
  initialRows?: readonly ManualMemberImportEditableRow[];
};

function getContentType(filename: string): PhotoEntry["contentType"] | null {
  const extension = filename.toLowerCase().split(".").pop();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return null;
}

async function readPhotoZip(file: File) {
  if (file.size <= 0 || file.size > MANUAL_MEMBER_IMPORT_LIMITS.zipBytes) {
    throw new Error("사진 ZIP은 100MB 이하만 업로드할 수 있습니다.");
  }
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (entries.length > MANUAL_MEMBER_IMPORT_LIMITS.maxRows) {
    throw new Error(`사진 ZIP에는 ${MANUAL_MEMBER_IMPORT_LIMITS.maxRows}개 이하의 사진만 넣어 주세요.`);
  }
  const seen = new Set<string>();
  const photos: PhotoEntry[] = [];
  for (const entry of entries) {
    if (!isManualMemberImportSafeFilename(entry.name)) {
      throw new Error("사진 ZIP에는 폴더·상위 경로 없이 사진 파일만 넣어 주세요.");
    }
    const normalizedName = entry.name.toLowerCase();
    if (seen.has(normalizedName)) {
      throw new Error("사진 ZIP에 같은 파일명이 중복되어 있습니다.");
    }
    seen.add(normalizedName);
    const contentType = getContentType(entry.name);
    if (!contentType || !MANUAL_MEMBER_IMPORT_IMAGE_CONTENT_TYPES.includes(contentType)) {
      throw new Error("사진은 JPEG, PNG, WebP 파일만 사용할 수 있습니다.");
    }
    const estimatedSize = Number(
      (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0,
    );
    if (estimatedSize <= 0 || estimatedSize > MANUAL_MEMBER_IMPORT_LIMITS.imageBytes) {
      throw new Error("사진 한 장은 5MB 이하만 사용할 수 있습니다.");
    }
    const bytes = await entry.async("uint8array");
    if (bytes.byteLength <= 0 || bytes.byteLength > MANUAL_MEMBER_IMPORT_LIMITS.imageBytes) {
      throw new Error("사진 한 장은 5MB 이하만 사용할 수 있습니다.");
    }
    const fileBytes = new Uint8Array(bytes.byteLength);
    fileBytes.set(bytes);
    photos.push({
      filename: entry.name,
      contentType,
      file: new File([fileBytes], entry.name, { type: contentType }),
    });
  }
  return photos;
}

function resultBadge(status: "success" | "failed") {
  return status === "success"
    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    : "bg-danger/15 text-danger";
}

function formatValidationErrors(errors: Array<{ rowNumber: number | null; message: string }>) {
  return errors
    .map((error) => (error.rowNumber === null ? error.message : `${error.rowNumber}행: ${error.message}`))
    .join("\n");
}

export default function AdminMemberManualAddPanel({
  currentGeneration = 16,
  mmLookupGenerations = [14, 15],
  initialRows = [],
}: AdminMemberManualAddPanelProps) {
  const xlsxRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef(new Map<number, HTMLDivElement>());
  const [rows, setRows] = useState<ManualMemberImportEditableRow[]>(() =>
    initialRows.map((row) => ({ ...row })),
  );
  const [zip, setZip] = useState<File | null>(null);
  const [batch, setBatch] = useState<PreflightSuccess | null>(null);
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"rows" | "validate" | "create" | null>(null);
  const { notify } = useToast();

  const photosLabel = useMemo(
    () => (zip ? `${zip.name} · ${photos.length}개 사진` : "사진 ZIP 없음 (사진 없이 초대)"),
    [photos.length, zip],
  );
  const mmLookupLabel = mmLookupGenerations.length > 0
    ? mmLookupGenerations.toSorted((left, right) => left - right).map((generation) => `${generation}기`).join("·")
    : "없음";

  function resetPreparedBatch() {
    setBatch(null);
    setResult(null);
    setError(null);
  }

  function focusRow(rowNumber: number | null) {
    if (rowNumber === null) return;
    requestAnimationFrame(() => {
      rowRefs.current.get(rowNumber)?.querySelector<HTMLElement>("input")?.focus();
    });
  }

  function addRow() {
    if (rows.length >= MANUAL_MEMBER_IMPORT_LIMITS.maxRows) {
      setError(`한 번에 ${MANUAL_MEMBER_IMPORT_LIMITS.maxRows}명까지만 추가할 수 있습니다.`);
      return;
    }
    const nextRows = addManualMemberImportEditableRow(rows);
    setRows(nextRows);
    resetPreparedBatch();
    focusRow(nextRows.at(-1)?.rowNumber ?? null);
  }

  function updateRow(
    rowNumber: number,
    field: Exclude<keyof ManualMemberImportEditableRow, "rowNumber">,
    value: string,
  ) {
    setRows((current) => current.map((row) =>
      row.rowNumber === rowNumber ? { ...row, [field]: value } : row,
    ));
    resetPreparedBatch();
  }

  function removeRow(rowNumber: number) {
    setRows((current) => current.filter((row) => row.rowNumber !== rowNumber));
    resetPreparedBatch();
  }

  async function appendWorkbookRows(file: File | null) {
    if (!file) return;
    if (file.size <= 0 || file.size > MANUAL_MEMBER_IMPORT_LIMITS.xlsxBytes) {
      setError("XLSX 파일은 1MB 이하만 업로드할 수 있습니다.");
      return;
    }
    setPending("rows");
    resetPreparedBatch();
    try {
      const formData = new FormData();
      formData.set("xlsx", file);
      const response = await fetch("/api/admin/member-imports/rows", {
        method: "POST",
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok || !Array.isArray(data.rows)) {
        throw new Error(Array.isArray(data.errors) ? data.errors.join("\n") : "XLSX 행을 읽지 못했습니다.");
      }
      const merged = appendManualMemberImportWorkbookRows(rows, data.rows);
      if (merged.appendedCount === 0) {
        throw new Error(`한 번에 ${MANUAL_MEMBER_IMPORT_LIMITS.maxRows}명까지만 추가할 수 있습니다.`);
      }
      setRows(merged.rows);
      if (merged.skippedCount > 0) {
        notify(`XLSX에서 ${merged.appendedCount}행을 추가했습니다. ${merged.skippedCount}행은 20명 제한으로 제외했습니다.`);
      } else {
        notify(`XLSX에서 ${merged.appendedCount}행을 추가했습니다. 내용을 검토한 뒤 검증을 시작해 주세요.`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "XLSX 행을 읽지 못했습니다.");
    } finally {
      if (xlsxRef.current) xlsxRef.current.value = "";
      setPending(null);
    }
  }

  async function prepare() {
    if (rows.length === 0) {
      setError("행 추가 또는 XLSX 업로드로 초대할 회원을 먼저 입력해 주세요.");
      xlsxRef.current?.focus();
      return;
    }
    const rawRows = toManualMemberImportRawRows(rows);
    const rowsResult = validateManualMemberImportRows(rawRows, {
      currentGeneration,
      mmLookupGenerations,
    });
    if (rowsResult.errors.length > 0 || rowsResult.acceptedRows.length !== rawRows.length) {
      setError(formatValidationErrors(rowsResult.errors));
      focusRow(rowsResult.errors[0]?.rowNumber ?? null);
      return;
    }

    setPending("validate");
    setError(null);
    setResult(null);
    try {
      const parsedPhotos = zip ? await readPhotoZip(zip) : [];
      const photoResult = validateManualMemberImportPhotoManifest(
        rowsResult.acceptedRows,
        parsedPhotos.map((photo) => ({
          filename: photo.filename,
          contentType: photo.contentType,
          size: photo.file.size,
        })),
      );
      if (photoResult.errors.length > 0) {
        setError(formatValidationErrors(photoResult.errors));
        focusRow(photoResult.errors[0]?.rowNumber ?? null);
        return;
      }
      const response = await fetch("/api/admin/member-imports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rows: rawRows,
          photos: parsedPhotos.map((photo) => ({
            filename: photo.filename,
            contentType: photo.contentType,
            size: photo.file.size,
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        throw new Error(Array.isArray(data.errors) ? data.errors.join("\n") : "회원 행 검증에 실패했습니다.");
      }
      const prepared = data as PreflightSuccess;
      const photoByFilename = new Map(parsedPhotos.map((photo) => [photo.filename, photo]));
      for (const upload of prepared.uploads) {
        const photo = photoByFilename.get(upload.filename);
        if (!photo) throw new Error(`${upload.rowNumber}행 사진 파일을 찾지 못했습니다.`);
        const uploadResponse = await fetch(upload.signedUrl, {
          method: "PUT",
          headers: { "content-type": photo.contentType, "x-upsert": "false" },
          body: photo.file,
        });
        if (!uploadResponse.ok) throw new Error(`${upload.rowNumber}행 사진 업로드에 실패했습니다.`);
      }
      setPhotos(parsedPhotos);
      setBatch(prepared);
      notify("행 검증과 사진 업로드가 완료되었습니다. 생성 시작을 눌러 주세요.");
    } catch (caught) {
      setBatch(null);
      setError(caught instanceof Error ? caught.message : "회원 행 검증에 실패했습니다.");
    } finally {
      setPending(null);
    }
  }

  async function createMembers() {
    if (!batch || pending) return;
    setPending("create");
    setError(null);
    try {
      const response = await fetch(`/api/admin/member-imports/${batch.batchId}/commit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok || !data.result) {
        throw new Error(data.message ?? "회원 생성에 실패했습니다.");
      }
      setResult(data.result as ImportResult);
      notify("회원 가져오기를 처리했습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "회원 생성에 실패했습니다.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 rounded-3xl border border-border bg-surface p-4 shadow-flat">
        <div className="grid gap-1">
          <h3 className="text-lg font-semibold text-foreground">행 기반 회원 초대</h3>
          <p className="text-sm text-muted-foreground">행을 직접 추가하거나 회원 XLSX를 올리면 입력 행으로 자동 추가됩니다. 내용을 검토한 뒤 사진 ZIP과 함께 검증해 주세요.</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface-inset px-4 py-3 text-sm text-muted-foreground">
          <p>기수: 운영진(0기)~현재 {currentGeneration}기 · MM 조회 지원: {mmLookupLabel}</p>
          <p className="mt-1">한 배치 {MANUAL_MEMBER_IMPORT_LIMITS.maxRows}명 · XLSX 1MB · 사진 ZIP 100MB · 사진 1장 5MB</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            회원 XLSX (업로드 시 행 자동 추가)
            <Input
              ref={xlsxRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="h-auto py-3"
              disabled={pending !== null}
              onChange={(event) => void appendWorkbookRows(event.target.files?.[0] ?? null)}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            사진 ZIP (선택)
            <Input
              ref={zipRef}
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              className="h-auto py-3"
              disabled={pending !== null}
              onChange={(event) => {
                setZip(event.target.files?.[0] ?? null);
                setPhotos([]);
                resetPreparedBatch();
              }}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{photosLabel}</p>
          <div className="flex flex-wrap gap-2">
            <a href="/api/admin/member-imports/template" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline">XLSX 템플릿 다운로드</a>
            <Button type="button" variant="secondary" onClick={addRow} disabled={pending !== null || rows.length >= MANUAL_MEMBER_IMPORT_LIMITS.maxRows}>행 추가</Button>
          </div>
        </div>

        <div className="grid gap-3" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold text-foreground">초대 행</h4>
            <span className="text-sm text-muted-foreground">{rows.length} / {MANUAL_MEMBER_IMPORT_LIMITS.maxRows}명</span>
          </div>
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface-inset px-4 py-6 text-sm text-muted-foreground">행 추가를 누르거나 회원 XLSX를 업로드해 초대할 회원을 입력해 주세요.</div>
          ) : (
            rows.map((row) => (
              <div
                key={row.rowNumber}
                ref={(element) => {
                  if (element) rowRefs.current.set(row.rowNumber, element);
                  else rowRefs.current.delete(row.rowNumber);
                }}
                className="grid min-w-0 gap-3 rounded-2xl border border-border bg-surface-inset p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">{row.rowNumber - 1}번째 회원</span>
                  <Button type="button" variant="secondary" onClick={() => removeRow(row.rowNumber)} disabled={pending !== null}>행 삭제</Button>
                </div>
                <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <label className="grid min-w-0 gap-1 text-sm font-medium text-foreground">기수<Input aria-label={`${row.rowNumber}행 기수`} type="number" min="0" max={currentGeneration} value={row.generation} disabled={pending !== null} onChange={(event) => updateRow(row.rowNumber, "generation", event.target.value)} /></label>
                  <label className="grid min-w-0 gap-1 text-sm font-medium text-foreground">이름<Input aria-label={`${row.rowNumber}행 이름`} value={row.name} disabled={pending !== null} onChange={(event) => updateRow(row.rowNumber, "name", event.target.value)} /></label>
                  <label className="grid min-w-0 gap-1 text-sm font-medium text-foreground">캠퍼스<Input aria-label={`${row.rowNumber}행 캠퍼스`} value={row.campus} disabled={pending !== null} onChange={(event) => updateRow(row.rowNumber, "campus", event.target.value)} /></label>
                  <label className="grid min-w-0 gap-1 text-sm font-medium text-foreground">MM ID<Input aria-label={`${row.rowNumber}행 MM ID`} value={row.mmId} disabled={pending !== null} onChange={(event) => updateRow(row.rowNumber, "mmId", event.target.value)} /></label>
                  <label className="grid min-w-0 gap-1 text-sm font-medium text-foreground">이메일<Input aria-label={`${row.rowNumber}행 이메일`} type="email" value={row.email} disabled={pending !== null} onChange={(event) => updateRow(row.rowNumber, "email", event.target.value)} /></label>
                  <label className="grid min-w-0 gap-1 text-sm font-medium text-foreground">사진 파일명<Input aria-label={`${row.rowNumber}행 사진 파일명`} value={row.photoFilename} disabled={pending !== null} onChange={(event) => updateRow(row.rowNumber, "photoFilename", event.target.value)} /></label>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={prepare} disabled={pending !== null || rows.length === 0} loading={pending === "validate"} loadingText="검증·업로드 중">검증 및 업로드</Button>
          <Button type="button" onClick={createMembers} disabled={!batch || pending !== null || Boolean(result)} loading={pending === "create"} loadingText="생성 중">생성 시작</Button>
        </div>
        {error ? <FormMessage variant="error" className="whitespace-pre-line">{error}</FormMessage> : null}
        {batch ? <FormMessage variant="muted">준비 완료 · {new Date(batch.expiresAt).toLocaleString("ko-KR")} 전까지 생성할 수 있습니다.</FormMessage> : null}
      </div>

      {result ? (
        <div className="grid gap-4 rounded-3xl border border-border bg-surface-elevated p-4 shadow-flat">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="text-lg font-semibold text-foreground">가져오기 결과</h3><p className="text-sm text-muted-foreground">성공 행은 유지되며, 실패 행은 원인을 수정해 새 배치로 재시도할 수 있습니다.</p></div>
            <div className="flex gap-2"><Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">성공 {result.success}</Badge><Badge className="bg-danger/15 text-danger">실패 {result.failed}</Badge></div>
          </div>
          <div className="grid gap-2">
            {result.items.map((item) => (
              <div key={item.rowNumber} className="rounded-2xl border border-border bg-surface-inset px-4 py-3">
                <div className="flex flex-wrap items-center gap-2"><Badge className={resultBadge(item.status)}>{item.status === "success" ? "성공" : "실패"}</Badge><span className="font-medium text-foreground">{item.rowNumber}행 · {item.name ?? item.mmId ?? item.email ?? "회원"}</span>{item.deliveryChannel ? <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300">{item.deliveryChannel === "mattermost" ? "MM 전송" : "이메일 전송"}</Badge> : null}</div>
                <p className="mt-2 text-sm text-muted-foreground">{item.status === "success" ? "계정 설정 링크를 전송했습니다. 첨부 사진은 검토 큐에서 승인 또는 반려할 수 있습니다." : item.reason ?? "처리 실패"}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
