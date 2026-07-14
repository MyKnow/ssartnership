"use client";

import JSZip from "jszip";
import { useMemo, useRef, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import {
  MANUAL_MEMBER_IMPORT_IMAGE_CONTENT_TYPES,
  MANUAL_MEMBER_IMPORT_LIMITS,
  isManualMemberImportSafeFilename,
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

export default function AdminMemberManualAddPanel() {
  const xlsxRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const [xlsx, setXlsx] = useState<File | null>(null);
  const [zip, setZip] = useState<File | null>(null);
  const [batch, setBatch] = useState<PreflightSuccess | null>(null);
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"validate" | "create" | null>(null);
  const { notify } = useToast();

  const photosLabel = useMemo(
    () => (zip ? `${zip.name} · ${photos.length}개 사진` : "사진 ZIP 없음 (사진 없이 초대)"),
    [photos.length, zip],
  );

  function resetPreparedBatch() {
    setBatch(null);
    setResult(null);
    setError(null);
  }

  async function prepare() {
    if (!xlsx) {
      setError("먼저 XLSX 템플릿을 선택해 주세요.");
      xlsxRef.current?.focus();
      return;
    }
    if (xlsx.size <= 0 || xlsx.size > MANUAL_MEMBER_IMPORT_LIMITS.xlsxBytes) {
      setError("XLSX 파일은 1MB 이하만 업로드할 수 있습니다.");
      return;
    }
    setPending("validate");
    setError(null);
    setResult(null);
    try {
      const parsedPhotos = zip ? await readPhotoZip(zip) : [];
      const formData = new FormData();
      formData.set("xlsx", xlsx);
      formData.set(
        "photos",
        JSON.stringify(
          parsedPhotos.map((photo) => ({
            filename: photo.filename,
            contentType: photo.contentType,
            size: photo.file.size,
          })),
        ),
      );
      const response = await fetch("/api/admin/member-imports", {
        method: "POST",
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        throw new Error(Array.isArray(data.errors) ? data.errors.join("\n") : "XLSX/ZIP 검증에 실패했습니다.");
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
      notify("파일 검증과 사진 업로드가 완료되었습니다. 생성 시작을 눌러 주세요.");
    } catch (caught) {
      setBatch(null);
      setError(caught instanceof Error ? caught.message : "XLSX/ZIP 검증에 실패했습니다.");
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
          <h3 className="text-lg font-semibold text-foreground">XLSX + 사진 ZIP 대량 초대</h3>
          <p className="text-sm text-muted-foreground">XLSX를 먼저 검증하고 사진을 private staging에 올린 뒤, 생성 시작에서 행별로 계정을 만듭니다.</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface-inset px-4 py-3 text-sm text-muted-foreground">
          <p>기수: 운영진(0기)~현재 16기 · MM 조회 기본 지원: 14·15기</p>
          <p className="mt-1">한 배치 20명 · XLSX 1MB · 사진 ZIP 100MB · 사진 1장 5MB</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            1. 회원 XLSX
            <Input ref={xlsxRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="h-auto py-3" onChange={(event) => { setXlsx(event.target.files?.[0] ?? null); resetPreparedBatch(); }} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            2. 사진 ZIP (선택)
            <Input ref={zipRef} type="file" accept=".zip,application/zip,application/x-zip-compressed" className="h-auto py-3" onChange={(event) => { setZip(event.target.files?.[0] ?? null); setPhotos([]); resetPreparedBatch(); }} />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">{photosLabel}</p>
        <div className="flex flex-wrap justify-between gap-3">
          <a href="/api/admin/member-imports/template" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline">XLSX 템플릿 다운로드</a>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={prepare} loading={pending === "validate"} loadingText="검증·업로드 중">검증 및 업로드</Button>
            <Button type="button" onClick={createMembers} disabled={!batch || pending !== null || Boolean(result)} loading={pending === "create"} loadingText="생성 중">생성 시작</Button>
          </div>
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
