"use client";

import JSZip from "jszip";
import { useMemo, useRef, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import {
  MANUAL_MEMBER_IMPORT_CAMPUS_OPTIONS,
  getManualMemberImportGenerationOptions,
} from "@/lib/member-manual-import/options";
import {
  MANUAL_MEMBER_IMPORT_PHOTO_ACCEPT,
  prepareManualMemberImportRowPhoto,
} from "@/lib/member-manual-import/photo.client";
import {
  getManualMemberImportErrorFocusField,
  type ManualMemberImportFocusField,
} from "@/lib/member-manual-import/focus";
import {
  addManualMemberImportEditableRow,
  appendManualMemberImportWorkbookRows,
  toManualMemberImportRawRows,
  type ManualMemberImportEditableRow,
} from "@/lib/member-manual-import/rows";
import {
  MANUAL_MEMBER_IMPORT_IMAGE_CONTENT_TYPES,
  MANUAL_MEMBER_IMPORT_LIMITS,
  getManualMemberImportRowReadiness,
  isManualMemberImportSafeFilename,
  validateManualMemberImportPhotoManifest,
} from "@/lib/member-manual-import/shared";

type PhotoEntry = {
  filename: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  file: File;
  sourceName: string;
};

type PreflightSuccess = {
  ok: true;
  batchId: string;
  expiresAt: string;
  uploads: Array<{ rowNumber: number; filename: string; signedUrl: string }>;
};

type ImportResult = {
  batchId: string;
  total: number;
  success: number;
  failed: number;
  retryableFailures: number;
  items: Array<{
    rowNumber: number;
    status: "success" | "failed";
    name: string | null;
    mmId: string | null;
    email: string | null;
    deliveryChannel: "mattermost" | "email" | null;
    reason: string | null;
    retryable: boolean;
  }>;
};

type ImportResultItem = ImportResult["items"][number];

type AdminMemberManualAddPanelProps = {
  currentGeneration?: number;
  initialRows?: readonly ManualMemberImportEditableRow[];
  canReissueManualSetup?: boolean;
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
      sourceName: entry.name,
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

function replaceImportResultItem(
  result: ImportResult,
  replacement: ImportResultItem,
): ImportResult {
  const items = result.items.map((item) =>
    item.rowNumber === replacement.rowNumber ? replacement : item,
  );
  const success = items.filter((item) => item.status === "success").length;
  const failed = items.length - success;
  return {
    ...result,
    success,
    failed,
    retryableFailures: items.filter((item) => item.status === "failed" && item.retryable).length,
    items,
  };
}

export default function AdminMemberManualAddPanel({
  currentGeneration = 16,
  initialRows = [],
  canReissueManualSetup = false,
}: AdminMemberManualAddPanelProps) {
  const xlsxRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef(new Map<number, HTMLDivElement>());
  const [rows, setRows] = useState<ManualMemberImportEditableRow[]>(() =>
    initialRows.map((row) => ({ ...row })),
  );
  const [zip, setZip] = useState<File | null>(null);
  const [batch, setBatch] = useState<PreflightSuccess | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<Map<number, PhotoEntry>>(
    () => new Map(),
  );
  const [ignoredZipPhotoFilenames, setIgnoredZipPhotoFilenames] = useState<Set<string>>(
    () => new Set(),
  );
  const [result, setResult] = useState<ImportResult | null>(null);
  const [reissuingRowNumber, setReissuingRowNumber] = useState<number | null>(null);
  const [confirmationRowNumber, setConfirmationRowNumber] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<
    "rows" | "photo" | "validate" | "create" | null
  >(null);
  const { notify } = useToast();

  const generationOptions = useMemo(
    () => getManualMemberImportGenerationOptions(currentGeneration),
    [currentGeneration],
  );
  const rawRows = useMemo(() => toManualMemberImportRawRows(rows), [rows]);
  const rowReadiness = useMemo(
    () => getManualMemberImportRowReadiness(rawRows, {
      currentGeneration,
    }),
    [currentGeneration, rawRows],
  );
  const canRetryFailedMembers = (result?.retryableFailures ?? 0) > 0;
  const canCreateMembers = Boolean(batch)
    && rowReadiness.isComplete
    && pending === null
    && (!result || canRetryFailedMembers);
  const photosLabel = useMemo(() => {
    const sources = [
      selectedPhotos.size > 0 ? `행별 사진 ${selectedPhotos.size}개 선택됨` : null,
      zip ? "사진 ZIP 선택됨" : null,
    ].filter((value): value is string => Boolean(value));
    return sources.length > 0 ? sources.join(" · ") : "사진을 선택하지 않았습니다.";
  }, [selectedPhotos, zip]);

  function resetPreparedBatch() {
    setBatch(null);
    setResult(null);
    setReissuingRowNumber(null);
    setConfirmationRowNumber(null);
    setError(null);
  }

  function focusRow(
    rowNumber: number | null,
    field: ManualMemberImportFocusField | null = null,
  ) {
    if (rowNumber === null) return;
    requestAnimationFrame(() => {
      const row = rowRefs.current.get(rowNumber);
      const target = field
        ? row?.querySelector<HTMLElement>(`[data-member-import-field="${field}"]`)
        : row?.querySelector<HTMLElement>("input, select");
      target?.focus();
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

  function ignoreZipPhotoFilename(filename: string | null | undefined) {
    if (!filename) return;
    setIgnoredZipPhotoFilenames((current) => {
      const next = new Set(current);
      next.add(filename.toLowerCase());
      return next;
    });
  }

  function removeRow(rowNumber: number) {
    ignoreZipPhotoFilename(rows.find((row) => row.rowNumber === rowNumber)?.photoFilename);
    setRows((current) => current.filter((row) => row.rowNumber !== rowNumber));
    setSelectedPhotos((current) => {
      const next = new Map(current);
      next.delete(rowNumber);
      return next;
    });
    resetPreparedBatch();
  }

  async function selectRowPhoto(rowNumber: number, file: File | null) {
    if (!file) return;
    const previousPhotoFilename = rows.find(
      (row) => row.rowNumber === rowNumber,
    )?.photoFilename;
    setPending("photo");
    setError(null);
    try {
      const photo = await prepareManualMemberImportRowPhoto(file, rowNumber);
      ignoreZipPhotoFilename(previousPhotoFilename);
      setSelectedPhotos((current) => {
        const next = new Map(current);
        next.set(rowNumber, photo);
        return next;
      });
      setRows((current) => current.map((row) =>
        row.rowNumber === rowNumber
          ? { ...row, photoFilename: photo.filename }
          : row,
      ));
      resetPreparedBatch();
      notify(`${rowNumber}행 사진을 선택했습니다.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "사진을 준비하지 못했습니다.");
    } finally {
      setPending(null);
    }
  }

  function clearRowPhoto(rowNumber: number) {
    ignoreZipPhotoFilename(rows.find((row) => row.rowNumber === rowNumber)?.photoFilename);
    setSelectedPhotos((current) => {
      const next = new Map(current);
      next.delete(rowNumber);
      return next;
    });
    updateRow(rowNumber, "photoFilename", "");
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
    const rowsResult = rowReadiness;
    if (!rowsResult.isComplete) {
      setError(formatValidationErrors(rowsResult.errors));
      const firstError = rowsResult.errors[0];
      focusRow(
        firstError?.rowNumber ?? null,
        firstError ? getManualMemberImportErrorFocusField(firstError.code) : null,
      );
      return;
    }

    setPending("validate");
    setError(null);
    setResult(null);
    try {
      const zipPhotos = zip
        ? (await readPhotoZip(zip)).filter(
          (photo) => !ignoredZipPhotoFilenames.has(photo.filename.toLowerCase()),
        )
        : [];
      const parsedPhotos = [...zipPhotos, ...selectedPhotos.values()];
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
        const firstError = photoResult.errors[0];
        focusRow(
          firstError?.rowNumber ?? null,
          firstError ? getManualMemberImportErrorFocusField(firstError.code) : null,
        );
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
    if (!batch || !rowReadiness.isComplete || pending || (result && result.retryableFailures === 0)) return;
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

  async function reissueManualSetup(item: ImportResultItem) {
    if (!result || item.status !== "failed" || item.retryable || reissuingRowNumber !== null) {
      return;
    }
    setReissuingRowNumber(item.rowNumber);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/member-imports/${encodeURIComponent(result.batchId)}/rows/${item.rowNumber}/reissue-setup`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ confirmed: true }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (
        !response.ok
        || !data.ok
        || !data.item
        || data.item.rowNumber !== item.rowNumber
        || data.item.status !== "success"
      ) {
        throw new Error(data.message ?? "새 초기 설정 링크를 발급하지 못했습니다.");
      }
      setResult((current) => current
        ? replaceImportResultItem(current, data.item as ImportResultItem)
        : current);
      setConfirmationRowNumber(null);
      notify(`${item.rowNumber}행에 새 초기 설정 링크를 발급했습니다.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "새 초기 설정 링크를 발급하지 못했습니다.");
    } finally {
      setReissuingRowNumber(null);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 rounded-3xl border border-border bg-surface p-4 shadow-flat">
        <div className="grid gap-1">
          <h3 className="text-lg font-semibold text-foreground">행 기반 회원 초대</h3>
          <p className="text-sm text-muted-foreground">행을 직접 추가하거나 회원 XLSX를 올리면 입력 행으로 자동 추가됩니다. 각 행에서 사진을 고르거나 XLSX와 사진 ZIP을 연결한 뒤 검증해 주세요.</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface-inset px-4 py-3 text-sm text-muted-foreground">
          <p>기수: 운영진(0기)~현재 {currentGeneration}기 · MM 조회는 해당 기수의 활성 Sender로 확인합니다.</p>
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
            사진 ZIP (XLSX 사진 연결용, 선택)
            <Input
              ref={zipRef}
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              className="h-auto py-3"
              disabled={pending !== null}
              onChange={(event) => {
                setZip(event.target.files?.[0] ?? null);
                setIgnoredZipPhotoFilenames(new Set());
                resetPreparedBatch();
              }}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 text-xs text-muted-foreground">{photosLabel}</p>
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
            rows.map((row) => {
              const selectedPhoto = selectedPhotos.get(row.rowNumber);
              return (
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
                  <label className="grid min-w-0 gap-1 text-sm font-medium text-foreground">
                    기수
                    <Select
                      aria-label={`${row.rowNumber}행 기수`}
                      data-member-import-field="generation"
                      value={row.generation}
                      disabled={pending !== null}
                      onChange={(event) => updateRow(row.rowNumber, "generation", event.target.value)}
                    >
                      <option value="" disabled>기수를 선택해 주세요</option>
                      {generationOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </Select>
                  </label>
                  <label className="grid min-w-0 gap-1 text-sm font-medium text-foreground">
                    이름
                    <Input
                      aria-label={`${row.rowNumber}행 이름`}
                      data-member-import-field="name"
                      value={row.name}
                      disabled={pending !== null}
                      onChange={(event) => updateRow(row.rowNumber, "name", event.target.value)}
                    />
                  </label>
                  <label className="grid min-w-0 gap-1 text-sm font-medium text-foreground">
                    캠퍼스
                    <Select
                      aria-label={`${row.rowNumber}행 캠퍼스`}
                      data-member-import-field="campus"
                      value={row.campus}
                      disabled={pending !== null}
                      onChange={(event) => updateRow(row.rowNumber, "campus", event.target.value)}
                    >
                      <option value="">캠퍼스를 선택해 주세요</option>
                      {MANUAL_MEMBER_IMPORT_CAMPUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </Select>
                  </label>
                  <label className="grid min-w-0 gap-1 text-sm font-medium text-foreground">
                    MM ID
                    <Input
                      aria-label={`${row.rowNumber}행 MM ID`}
                      aria-describedby={`member-import-contact-rule-${row.rowNumber}`}
                      data-member-import-field="mmId"
                      value={row.mmId}
                      disabled={pending !== null}
                      onChange={(event) => updateRow(row.rowNumber, "mmId", event.target.value)}
                    />
                  </label>
                  <label className="grid min-w-0 gap-1 text-sm font-medium text-foreground">
                    이메일
                    <Input
                      aria-label={`${row.rowNumber}행 이메일`}
                      aria-describedby={`member-import-contact-rule-${row.rowNumber}`}
                      data-member-import-field="email"
                      type="email"
                      value={row.email}
                      disabled={pending !== null}
                      onChange={(event) => updateRow(row.rowNumber, "email", event.target.value)}
                    />
                  </label>
  <p
    id={`member-import-contact-rule-${row.rowNumber}`}
    className="md:col-span-2 xl:col-span-3 text-xs font-normal text-muted-foreground"
  >
    <span className="block">MM ID 또는 이메일 중 하나는 필수입니다.</span>
    <span className="block">MM 조회 미지원 기수에서는</span>
    <span className="block">MM ID 대신 이메일만 입력해 주세요.</span>
    <span className="block">단, 이메일만 입력하면 이름과 캠퍼스도 필요합니다.</span>
  </p>
                  <div className="grid min-w-0 gap-1 text-sm font-medium text-foreground">
                    <label htmlFor={`member-import-photo-${row.rowNumber}`}>사진 (선택 사항)</label>
                    <Input
                      id={`member-import-photo-${row.rowNumber}`}
                      aria-label={`${row.rowNumber}행 사진 선택`}
                      data-member-import-field="photo"
                      type="file"
                      accept={MANUAL_MEMBER_IMPORT_PHOTO_ACCEPT}
                      className="h-auto min-w-0 py-2 text-sm"
                      disabled={pending !== null}
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        event.target.value = "";
                        void selectRowPhoto(row.rowNumber, file);
                      }}
                    />
                    {selectedPhoto ? (
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <p
                          className="min-w-0 truncate text-xs font-normal text-muted-foreground"
                          title={selectedPhoto.sourceName}
                        >
                          선택됨 · {selectedPhoto.sourceName}
                        </p>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => clearRowPhoto(row.rowNumber)}
                          disabled={pending !== null}
                        >
                          사진 해제
                        </Button>
                      </div>
                    ) : row.photoFilename ? (
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-xs font-normal text-muted-foreground">
                          사진 ZIP 연결됨
                        </p>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => clearRowPhoto(row.rowNumber)}
                          disabled={pending !== null}
                        >
                          사진 연결 해제
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs font-normal text-muted-foreground">JPEG·PNG·WebP·HEIC·HEIF, 5MB 이하</p>
                    )}
                  </div>
                </div>
                </div>
              );
            })
          )}
        </div>

        <div className="grid gap-2">
          <p className="text-right text-xs text-muted-foreground">
            모든 행의 필수 항목을 입력하고 검증·업로드를 완료하면 생성 시작이 활성화됩니다.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={prepare} disabled={pending !== null || rows.length === 0} loading={pending === "validate"} loadingText="검증·업로드 중">검증 및 업로드</Button>
            <Button type="button" onClick={createMembers} disabled={!canCreateMembers} loading={pending === "create"} loadingText="생성 중">{canRetryFailedMembers ? "실패 행 재시도" : result ? "자동 재시도 불가" : "생성 시작"}</Button>
          </div>
        </div>
        {error ? <FormMessage variant="error" className="whitespace-pre-line">{error}</FormMessage> : null}
        {batch ? <FormMessage variant="muted">준비 완료 · {new Date(batch.expiresAt).toLocaleString("ko-KR")} 전까지 생성할 수 있습니다.</FormMessage> : null}
      </div>

      {result ? (
        <div className="grid gap-4 rounded-3xl border border-border bg-surface-elevated p-4 shadow-flat">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="text-lg font-semibold text-foreground">가져오기 결과</h3><p className="text-sm text-muted-foreground">{result.failed === 0 ? "성공 행은 유지됩니다." : result.retryableFailures === 0 ? "전송 결과 확인이 필요한 행이 있어 자동 재시도는 중지되었습니다." : result.retryableFailures < result.failed ? "재시도 가능한 실패 행만 같은 준비 배치에서 다시 시도합니다. 전송 결과 확인이 필요한 행은 자동 재시도하지 않습니다." : "성공 행은 유지됩니다. 실패 행이 있으면 같은 준비 배치에서 실패 행만 다시 시도할 수 있습니다."}</p></div>
            <div className="flex gap-2"><Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">성공 {result.success}</Badge><Badge className="bg-danger/15 text-danger">실패 {result.failed}</Badge></div>
          </div>
          <div className="grid gap-2">
            {result.items.map((item) => (
              <div key={item.rowNumber} className="rounded-2xl border border-border bg-surface-inset px-4 py-3">
                <div className="flex flex-wrap items-center gap-2"><Badge className={resultBadge(item.status)}>{item.status === "success" ? "성공" : "실패"}</Badge><span className="font-medium text-foreground">{item.rowNumber}행 · {item.name ?? item.mmId ?? item.email ?? "회원"}</span>{item.deliveryChannel ? <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300">{item.deliveryChannel === "mattermost" ? "MM 전송" : "이메일 전송"}</Badge> : null}</div>
                <p className="mt-2 text-sm text-muted-foreground">{item.status === "success" ? "계정 설정 링크를 전송했습니다. 첨부 사진은 검토 큐에서 승인 또는 반려할 수 있습니다." : item.retryable ? item.reason ?? "처리 실패" : `자동 재시도 중지 · ${item.reason ?? "전송 결과 확인 필요"}`}</p>
                {canReissueManualSetup && item.status === "failed" && !item.retryable ? (
                  <div className="mt-3 rounded-xl border border-warning/30 bg-warning/10 p-3">
                    {confirmationRowNumber === item.rowNumber ? (
                      <div className="grid gap-3">
                        <p className="text-sm text-foreground">수신자에게 기존 링크가 전달되지 않았음을 확인한 뒤 발급해 주세요. 기존 미사용 링크는 무효화됩니다.</p>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button type="button" variant="secondary" onClick={() => setConfirmationRowNumber(null)} disabled={reissuingRowNumber !== null}>취소</Button>
                          <Button type="button" onClick={() => void reissueManualSetup(item)} disabled={reissuingRowNumber !== null} loading={reissuingRowNumber === item.rowNumber} loadingText="발급 중">새 링크 발급 확인</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-muted-foreground">관리자 확인 후 기존 전송 채널로 새 초기 설정 링크를 발급할 수 있습니다.</p>
                        <Button type="button" variant="secondary" onClick={() => setConfirmationRowNumber(item.rowNumber)} disabled={reissuingRowNumber !== null}>확인 후 새 링크 발급</Button>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
