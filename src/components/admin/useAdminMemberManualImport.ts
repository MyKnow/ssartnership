"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useManualMemberImportDraft,
  type ManualMemberImportDraftSnapshotWithFiles,
} from "./useManualMemberImportDraft";
import { useToast } from "@/components/ui/Toast";
import { getSafeAdminResponseMessage } from "@/lib/admin-safe-messages";
import { getManualMemberImportGenerationOptions } from "@/lib/member-manual-import/options";
import {
  getManualMemberImportPhotoUploadClientId,
  getManualMemberImportSelectedPhotoFilename,
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
  MANUAL_MEMBER_IMPORT_LIMITS,
  getManualMemberImportRowReadiness,
  validateManualMemberImportPhotoManifest,
} from "@/lib/member-manual-import/shared";
import {
  getImageUploadSourceError,
  prepareImageUploadSource,
} from "@/lib/image-upload/client-transform";
import { uploadImagesToStaging } from "@/lib/image-upload/client";
import { inferImageSourceContentType } from "@/lib/image-upload/policy";
import type {
  ManualMemberImportCommitResult as ImportResult,
  ManualMemberImportCommitItem as ImportResultItem,
} from "@/lib/member-manual-import/types";
import { replaceImportResultItem } from "@/lib/member-manual-import/results";
import {
  MANUAL_MEMBER_IMAGE_POLICY,
  readPhotoZip,
  type PhotoEntry,
  type RowPhotoCrop,
  type ZipPhotoCrop,
} from "./manual-member-import-photos";

type PreflightSuccess = {
  ok: true;
  batchId: string;
  expiresAt: string;
};

function formatValidationErrors(errors: Array<{ rowNumber: number | null; message: string }>) {
  return errors
    .map((error) => (error.rowNumber === null ? error.message : `${error.rowNumber}행: ${error.message}`))
    .join("\n");
}

export function useAdminMemberManualImport({ currentGeneration, initialRows }: {
  currentGeneration: number;
  initialRows: readonly ManualMemberImportEditableRow[];
}) {
  const xlsxRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef(new Map<number, HTMLDivElement>());
  const rowPhotoCropUrlRef = useRef<string | null>(null);
  const zipPhotoCropUrlRef = useRef<string | null>(null);
  const [rows, setRows] = useState<ManualMemberImportEditableRow[]>(() =>
    initialRows.map((row) => ({ ...row })),
  );
  const [zip, setZip] = useState<File | null>(null);
  const [batch, setBatch] = useState<PreflightSuccess | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<Map<number, PhotoEntry>>(
    () => new Map(),
  );
  const [rowPhotoCrop, setRowPhotoCrop] = useState<RowPhotoCrop | null>(null);
  const [zipPhotoCrop, setZipPhotoCrop] = useState<ZipPhotoCrop | null>(null);
  const [croppedZipPhotos, setCroppedZipPhotos] = useState<PhotoEntry[] | null>(null);
  const [uploadedPhotoIds, setUploadedPhotoIds] = useState<Map<string, string>>(
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

  useEffect(() => () => {
    if (rowPhotoCropUrlRef.current) {
      URL.revokeObjectURL(rowPhotoCropUrlRef.current);
    }
    if (zipPhotoCropUrlRef.current) {
      URL.revokeObjectURL(zipPhotoCropUrlRef.current);
    }
  }, []);

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
      croppedZipPhotos ? "사진 ZIP 편집 완료" : zip ? "사진 ZIP 선택됨" : null,
    ].filter((value): value is string => Boolean(value));
    return sources.length > 0 ? sources.join(" · ") : "사진을 선택하지 않았습니다.";
  }, [croppedZipPhotos, selectedPhotos, zip]);

  const manualImportDraftSnapshot = useMemo<ManualMemberImportDraftSnapshotWithFiles>(() => {
    const toDraftPhoto = (
      photo: PhotoEntry,
      input: { clientId: string; source: "row" | "zip"; rowNumber?: number },
    ) => {
      const uploadId = uploadedPhotoIds.get(photo.filename.toLowerCase());
      return {
        ...input,
        filename: photo.filename,
        contentType: photo.contentType,
        sourceName: photo.sourceName,
        file: photo.file,
        ...(uploadId ? { uploadId } : {}),
      };
    };
    return {
      rows,
      batch: batch ? { ...batch } : null,
      ignoredZipPhotoFilenames: Array.from(ignoredZipPhotoFilenames),
      photos: [
        ...(croppedZipPhotos ?? []).map((photo, index) => toDraftPhoto(photo, {
          clientId: `manual-zip-${index}`,
          source: "zip",
        })),
        ...Array.from(selectedPhotos.entries())
          .sort(([left], [right]) => left - right)
          .map(([rowNumber, photo]) => toDraftPhoto(photo, {
            clientId: `manual-row-${rowNumber}`,
            source: "row",
            rowNumber,
          })),
      ],
    };
  }, [batch, croppedZipPhotos, ignoredZipPhotoFilenames, rows, selectedPhotos, uploadedPhotoIds]);

  const restoreManualMemberImportDraft = useCallback((draft: ManualMemberImportDraftSnapshotWithFiles) => {
    const restoredSelectedPhotos = new Map<number, PhotoEntry>();
    const restoredZipPhotos: PhotoEntry[] = [];
    const restoredUploadIds = new Map<string, string>();
    for (const photo of draft.photos) {
      const restoredPhoto: PhotoEntry = {
        filename: photo.filename,
        contentType: photo.contentType,
        file: photo.file,
        sourceName: photo.sourceName,
        ...(photo.uploadId ? { uploadId: photo.uploadId } : {}),
      };
      if (photo.uploadId) {
        restoredUploadIds.set(photo.filename.toLowerCase(), photo.uploadId);
      }
      if (photo.source === "row" && photo.rowNumber) {
        restoredSelectedPhotos.set(photo.rowNumber, restoredPhoto);
      } else {
        restoredZipPhotos.push(restoredPhoto);
      }
    }
    setRows(draft.rows);
    setSelectedPhotos(restoredSelectedPhotos);
    setCroppedZipPhotos(restoredZipPhotos.length > 0 ? restoredZipPhotos : null);
    setUploadedPhotoIds(restoredUploadIds);
    setIgnoredZipPhotoFilenames(new Set(draft.ignoredZipPhotoFilenames));
    setBatch(draft.batch ? { ok: true, ...draft.batch } : null);
    setError(null);
    if (draft.rows.length > 0 || draft.photos.length > 0 || draft.batch) {
      notify("작성 중이던 회원 초대와 사진을 복구했습니다.");
    }
  }, [notify]);

  const { clear: clearManualMemberImportDraft } = useManualMemberImportDraft({
    formKey: "admin-manual-member-import",
    snapshot: manualImportDraftSnapshot,
    onRestore: restoreManualMemberImportDraft,
  });

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
    const photoFilename = rows.find((row) => row.rowNumber === rowNumber)?.photoFilename;
    ignoreZipPhotoFilename(photoFilename);
    if (photoFilename) {
      setUploadedPhotoIds((current) => {
        const next = new Map(current);
        next.delete(photoFilename.toLowerCase());
        return next;
      });
    }
    setRows((current) => current.filter((row) => row.rowNumber !== rowNumber));
    setSelectedPhotos((current) => {
      const next = new Map(current);
      next.delete(rowNumber);
      return next;
    });
    resetPreparedBatch();
  }

  function closeRowPhotoCrop() {
    if (rowPhotoCropUrlRef.current) {
      URL.revokeObjectURL(rowPhotoCropUrlRef.current);
      rowPhotoCropUrlRef.current = null;
    }
    setRowPhotoCrop(null);
  }

  function closeZipPhotoCrop() {
    if (zipPhotoCropUrlRef.current) {
      URL.revokeObjectURL(zipPhotoCropUrlRef.current);
      zipPhotoCropUrlRef.current = null;
    }
    setZipPhotoCrop(null);
  }

  function openZipPhotoCrop(
    photos: PhotoEntry[],
    croppedPhotos: PhotoEntry[],
    index: number,
  ) {
    const photo = photos[index];
    if (!photo) return;
    if (zipPhotoCropUrlRef.current) {
      URL.revokeObjectURL(zipPhotoCropUrlRef.current);
    }
    const sourceUrl = URL.createObjectURL(photo.file);
    zipPhotoCropUrlRef.current = sourceUrl;
    setZipPhotoCrop({ photos, croppedPhotos, index, sourceUrl });
  }

  function applyRowPhoto(rowNumber: number, file: File, sourceName: string) {
    const previousPhotoFilename = rows.find(
      (row) => row.rowNumber === rowNumber,
    )?.photoFilename;
    const contentType = inferImageSourceContentType(file);
    if (!contentType) {
      setError("사진 형식을 확인할 수 없습니다.");
      return;
    }
    const filename = getManualMemberImportSelectedPhotoFilename(rowNumber, contentType);
    const photo: PhotoEntry = {
      filename,
      contentType,
      file: new File([file], filename, {
        type: contentType,
        lastModified: file.lastModified,
      }),
      sourceName,
    };
    ignoreZipPhotoFilename(previousPhotoFilename);
    if (previousPhotoFilename) {
      setUploadedPhotoIds((current) => {
        const next = new Map(current);
        next.delete(previousPhotoFilename.toLowerCase());
        return next;
      });
    }
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
  }

  async function selectRowPhoto(rowNumber: number, file: File | null) {
    if (!file) return;
    const sourceError = getImageUploadSourceError(file, MANUAL_MEMBER_IMAGE_POLICY);
    if (sourceError) {
      setError(sourceError);
      return;
    }
    setPending("photo");
    setError(null);
    try {
      const sourceFile = await prepareImageUploadSource(file, MANUAL_MEMBER_IMAGE_POLICY);
      if (rowPhotoCropUrlRef.current) {
        URL.revokeObjectURL(rowPhotoCropUrlRef.current);
      }
      const sourceUrl = URL.createObjectURL(sourceFile);
      rowPhotoCropUrlRef.current = sourceUrl;
      setRowPhotoCrop({
        rowNumber,
        sourceName: file.name,
        sourceFile,
        sourceUrl,
      });
    } catch {
      setError("사진을 준비하지 못했습니다.");
    } finally {
      setPending(null);
    }
  }

  function clearRowPhoto(rowNumber: number) {
    const photoFilename = rows.find((row) => row.rowNumber === rowNumber)?.photoFilename;
    ignoreZipPhotoFilename(photoFilename);
    if (photoFilename) {
      setUploadedPhotoIds((current) => {
        const next = new Map(current);
        next.delete(photoFilename.toLowerCase());
        return next;
      });
    }
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
        setError(
          getSafeAdminResponseMessage(
            Array.isArray(data.errors) ? data.errors[0] : undefined,
            "XLSX 행을 읽지 못했습니다.",
          ),
        );
        return;
      }
      const merged = appendManualMemberImportWorkbookRows(rows, data.rows);
      if (merged.appendedCount === 0) {
        setError(`한 번에 ${MANUAL_MEMBER_IMPORT_LIMITS.maxRows}명까지만 추가할 수 있습니다.`);
        return;
      }
      setRows(merged.rows);
      if (merged.skippedCount > 0) {
        notify(`XLSX에서 ${merged.appendedCount}행을 추가했습니다. ${merged.skippedCount}행은 20명 제한으로 제외했습니다.`);
      } else {
        notify(`XLSX에서 ${merged.appendedCount}행을 추가했습니다. 내용을 검토한 뒤 검증을 시작해 주세요.`);
      }
    } catch {
      setError("XLSX 행을 읽지 못했습니다.");
    } finally {
      if (xlsxRef.current) xlsxRef.current.value = "";
      setPending(null);
    }
  }

  async function finalizePreparation(zipPhotos: PhotoEntry[]) {
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
      const parsedPhotos = [
        ...zipPhotos.filter(
          (photo) => !ignoredZipPhotoFilenames.has(photo.filename.toLowerCase()),
        ),
        ...selectedPhotos.values(),
      ];
      const photoResult = validateManualMemberImportPhotoManifest(
        rowsResult.acceptedRows,
        parsedPhotos.map((photo) => ({
          filename: photo.filename,
          contentType: photo.contentType,
          size: photo.file.size,
          uploadId: uploadedPhotoIds.get(photo.filename.toLowerCase()),
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
      const pendingUploadFilenameByClientId = new Map<string, string>();
      const pendingUploads = parsedPhotos.flatMap((photo, index) => {
        if (uploadedPhotoIds.has(photo.filename.toLowerCase())) return [];
        const clientId = getManualMemberImportPhotoUploadClientId(index);
        pendingUploadFilenameByClientId.set(clientId, photo.filename.toLowerCase());
        return [{ clientId, role: "profile" as const, file: photo.file }];
      });
      const uploadResults = await uploadImagesToStaging({
        purpose: "manual-member-import",
        actorMode: "admin",
        uploads: pendingUploads,
      });
      const nextUploadedPhotoIds = new Map(uploadedPhotoIds);
      for (const result of uploadResults) {
        const filename = pendingUploadFilenameByClientId.get(result.clientId);
        if (!filename) {
          throw new Error("사진 업로드 정보를 확인해 주세요.");
        }
        nextUploadedPhotoIds.set(filename, result.uploadId);
      }
      setUploadedPhotoIds(nextUploadedPhotoIds);
      const photoManifest = parsedPhotos.map((photo) => {
        const uploadId = nextUploadedPhotoIds.get(photo.filename.toLowerCase());
        if (!uploadId) {
          throw new Error("사진 업로드 정보를 확인해 주세요.");
        }
        return {
          filename: photo.filename,
          contentType: photo.contentType,
          size: photo.file.size,
          uploadId,
        };
      });
      const response = await fetch("/api/admin/member-imports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rows: rawRows,
          photos: photoManifest,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        setBatch(null);
        setError(
          getSafeAdminResponseMessage(
            Array.isArray(data.errors) ? data.errors[0] : undefined,
            "회원 행 검증에 실패했습니다. 입력 항목을 확인한 뒤 다시 시도해 주세요.",
          ),
        );
        return;
      }
      const prepared = data as PreflightSuccess;
      setBatch(prepared);
      notify("행 검증과 사진 업로드가 완료되었습니다. 생성 시작을 눌러 주세요.");
    } catch {
      setBatch(null);
      setError("회원 행 검증에 실패했습니다. 입력 항목을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setPending(null);
    }
  }

  async function prepare() {
    if (!zip || croppedZipPhotos) {
      await finalizePreparation(croppedZipPhotos ?? []);
      return;
    }
    setPending("validate");
    setError(null);
    setResult(null);
    try {
      const zipPhotos = (await readPhotoZip(zip)).filter(
        (photo) => !ignoredZipPhotoFilenames.has(photo.filename.toLowerCase()),
      );
      if (zipPhotos.length === 0) {
        await finalizePreparation([]);
        return;
      }
      openZipPhotoCrop(zipPhotos, [], 0);
      notify(`사진 ZIP ${zipPhotos.length}장을 순서대로 확인해 주세요.`);
    } catch {
      setBatch(null);
      setError("사진 ZIP을 준비하지 못했습니다. 파일을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setPending(null);
    }
  }

  function applyZipPhotoCrop(file: File) {
    if (!zipPhotoCrop) return;
    const sourcePhoto = zipPhotoCrop.photos[zipPhotoCrop.index];
    const contentType = sourcePhoto ? inferImageSourceContentType(file) : null;
    if (!sourcePhoto || !contentType) {
      setError("사진 형식을 확인할 수 없습니다.");
      closeZipPhotoCrop();
      return;
    }
    const croppedPhoto: PhotoEntry = {
      ...sourcePhoto,
      contentType,
      file: new File([file], sourcePhoto.filename, {
        type: contentType,
        lastModified: file.lastModified,
      }),
    };
    const nextCroppedPhotos = [...zipPhotoCrop.croppedPhotos, croppedPhoto];
    const nextIndex = zipPhotoCrop.index + 1;
    if (nextIndex < zipPhotoCrop.photos.length) {
      openZipPhotoCrop(zipPhotoCrop.photos, nextCroppedPhotos, nextIndex);
      return;
    }
    closeZipPhotoCrop();
    setCroppedZipPhotos(nextCroppedPhotos);
    void finalizePreparation(nextCroppedPhotos);
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
        setError(
          getSafeAdminResponseMessage(
            data.message,
            "회원 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
          ),
        );
        return;
      }
      const nextResult = data.result as ImportResult;
      setResult(nextResult);
      if (nextResult.failed === 0) {
        void clearManualMemberImportDraft();
      }
      // 일부 행이 실패하면 2.5초 안내로 지나가지 않도록 오류 톤으로 알린다.
      notify(
        nextResult.failed > 0
          ? `회원 가져오기를 처리했습니다. 실패한 ${nextResult.failed}건은 가져오기 결과에서 확인해 주세요.`
          : "회원 가져오기를 처리했습니다.",
        nextResult.failed > 0 ? { tone: "error" } : undefined,
      );
    } catch {
      setError("회원 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.");
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
        setError(
          getSafeAdminResponseMessage(
            data.message,
            "새 초기 설정 링크를 발급하지 못했습니다. 수신 여부를 확인한 뒤 다시 시도해 주세요.",
          ),
        );
        return;
      }
      setResult((current) => current
        ? replaceImportResultItem(current, data.item as ImportResultItem)
        : current);
      setConfirmationRowNumber(null);
      notify(`${item.rowNumber}행에 새 초기 설정 링크를 발급했습니다.`);
    } catch {
      setError("새 초기 설정 링크를 발급하지 못했습니다. 수신 여부를 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setReissuingRowNumber(null);
    }
  }

  function selectZip(file: File | null) {
    setZip(file);
    setCroppedZipPhotos(null);
    closeZipPhotoCrop();
    setIgnoredZipPhotoFilenames(new Set());
    setUploadedPhotoIds(new Map());
    resetPreparedBatch();
  }

  function applyCroppedRowPhoto(file: File) {
    if (!rowPhotoCrop) return;
    applyRowPhoto(rowPhotoCrop.rowNumber, file, rowPhotoCrop.sourceName);
    closeRowPhotoCrop();
  }

  function cancelZipPhotoCrop() {
    closeZipPhotoCrop();
    setError("사진 ZIP 편집을 취소했습니다. 검증 및 업로드를 다시 누르면 처음부터 확인할 수 있습니다.");
  }

  return {
    xlsxRef, zipRef, rowRefs, rows, batch, selectedPhotos, rowPhotoCrop, zipPhotoCrop,
    result, reissuingRowNumber, confirmationRowNumber, setConfirmationRowNumber,
    error, pending, generationOptions, canRetryFailedMembers, canCreateMembers, photosLabel,
    addRow, updateRow, removeRow, selectRowPhoto, clearRowPhoto, appendWorkbookRows,
    prepare, createMembers, reissueManualSetup, selectZip, applyCroppedRowPhoto,
    closeRowPhotoCrop, cancelZipPhotoCrop, applyZipPhotoCrop,
  };
}
