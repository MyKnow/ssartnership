"use client";

import Link from "next/link";
import ImageCropDialog from "@/components/media/ImageCropDialog";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { formatKoreanLocaleDateTime } from "@/lib/datetime";
import { MANUAL_MEMBER_IMPORT_CAMPUS_OPTIONS } from "@/lib/member-manual-import/options";
import { MANUAL_MEMBER_IMPORT_PHOTO_ACCEPT } from "@/lib/member-manual-import/photo.client";
import { MANUAL_MEMBER_IMPORT_LIMITS } from "@/lib/member-manual-import/shared";
import type { ManualMemberImportEditableRow } from "@/lib/member-manual-import/rows";
import type { ManualMemberImportCommitItem } from "@/lib/member-manual-import/types";
import { MANUAL_MEMBER_IMAGE_POLICY } from "./manual-member-import-photos";
import { useAdminMemberManualImport } from "./useAdminMemberManualImport";
type AdminMemberManualAddPanelProps = {
  currentGeneration?: number;
  initialRows?: readonly ManualMemberImportEditableRow[];
  canReissueManualSetup?: boolean;
};

function resultBadge(status: ManualMemberImportCommitItem["status"]) {
  if (status === "success") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (status === "already_exists") return "bg-warning/15 text-warning";
  return "bg-danger/15 text-danger";
}

export default function AdminMemberManualAddPanel({
  currentGeneration = 16,
  initialRows = [],
  canReissueManualSetup = false,
}: AdminMemberManualAddPanelProps) {
  const {
    xlsxRef, zipRef, rowRefs, rows, batch, selectedPhotos, rowPhotoCrop, zipPhotoCrop,
    result, reissuingRowNumber, confirmationRowNumber, setConfirmationRowNumber,
    error, pending, generationOptions, canRetryFailedMembers, canCreateMembers, photosLabel,
    addRow, updateRow, removeRow, selectRowPhoto, clearRowPhoto, appendWorkbookRows,
    prepare, createMembers, reissueManualSetup, selectZip, applyCroppedRowPhoto,
    closeRowPhotoCrop, cancelZipPhotoCrop, applyZipPhotoCrop,
  } = useAdminMemberManualImport({ currentGeneration, initialRows });

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
              onChange={(event) => selectZip(event.target.files?.[0] ?? null)}
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
            <EmptyState
              size="sm"
              title="아직 초대할 회원 행이 없습니다."
              description="행 추가를 누르거나 회원 XLSX를 업로드해 초대할 회원을 입력해 주세요."
            />
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
                    <label
                      className="min-w-0"
                      htmlFor={`member-import-photo-${row.rowNumber}`}
                    >
                      사진 (선택 사항)
                    </label>
                    <Input
                      id={`member-import-photo-${row.rowNumber}`}
                      aria-label={`${row.rowNumber}행 사진 선택`}
                      data-member-import-field="photo"
                      type="file"
                      accept={MANUAL_MEMBER_IMPORT_PHOTO_ACCEPT}
                      className="h-auto min-w-0 max-w-full py-2 text-sm"
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
                      <p className="min-w-0 break-words text-xs font-normal text-muted-foreground">
                        JPEG·PNG·WebP·AVIF·HEIC/HEIF·GIF·BMP·TIFF·SVG, 5MB 이하
                      </p>
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
        {batch ? <FormMessage variant="muted">준비 완료 · {formatKoreanLocaleDateTime(batch.expiresAt)} 전까지 생성할 수 있습니다.</FormMessage> : null}
      </div>

      {result ? (
        <div className="grid gap-4 rounded-3xl border border-border bg-surface-elevated p-4 shadow-flat">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="text-lg font-semibold text-foreground">가져오기 결과</h3><p className="text-sm text-muted-foreground">{result.alreadyExists > 0 ? "이미 등록된 회원은 생성하거나 설정 링크를 전송하지 않았습니다." : result.failed === 0 ? "성공 행은 유지됩니다." : result.retryableFailures === 0 ? "전송 결과 확인이 필요한 행이 있어 자동 재시도는 중지되었습니다." : result.retryableFailures < result.failed ? "재시도 가능한 실패 행만 같은 준비 배치에서 다시 시도합니다. 전송 결과 확인이 필요한 행은 자동 재시도하지 않습니다." : "성공 행은 유지됩니다. 실패 행이 있으면 같은 준비 배치에서 실패 행만 다시 시도할 수 있습니다."}</p></div>
            <div className="flex flex-wrap gap-2"><Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">성공 {result.success}</Badge>{result.alreadyExists > 0 ? <Badge className="bg-warning/15 text-warning">이미 등록됨 {result.alreadyExists}</Badge> : null}<Badge className="bg-danger/15 text-danger">실패 {result.failed}</Badge></div>
          </div>
          <div className="grid gap-2">
            {result.items.map((item) => (
              <div key={item.rowNumber} className="rounded-2xl border border-border bg-surface-inset px-4 py-3">
                <div className="flex flex-wrap items-center gap-2"><Badge className={resultBadge(item.status)}>{item.status === "success" ? "성공" : item.status === "already_exists" ? "이미 등록됨" : "실패"}</Badge><span className="font-medium text-foreground">{item.rowNumber}행 · {item.name ?? item.mmId ?? item.email ?? "회원"}</span>{item.deliveryChannel ? <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300">{item.deliveryChannel === "mattermost" ? "MM 전송" : "이메일 전송"}</Badge> : null}</div>
                <p className="mt-2 text-sm text-muted-foreground">{item.status === "success" ? "계정 설정 링크를 전송했습니다. 첨부 사진은 검토 큐에서 승인 또는 반려할 수 있습니다." : item.status === "already_exists" ? "이미 등록된 회원입니다. 새 회원과 설정 링크는 만들지 않았습니다." : item.retryable ? item.reason ?? "처리 실패" : `자동 재시도 중지 · ${item.reason ?? "전송 결과 확인 필요"}`}</p>
                {item.status === "already_exists" && item.existingMemberId ? <Link prefetch={false} className="mt-3 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background" href={`/admin/members/${encodeURIComponent(item.existingMemberId)}`}>기존 회원 상세</Link> : null}
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

      <ImageCropDialog
        open={Boolean(rowPhotoCrop)}
        aspectRatio={1}
        sourceUrl={rowPhotoCrop?.sourceUrl ?? ""}
        sourceFile={rowPhotoCrop?.sourceFile}
        outputName={`manual-row-${rowPhotoCrop?.rowNumber ?? "photo"}.webp`}
        outputWidth={640}
        outputHeight={640}
        policy={MANUAL_MEMBER_IMAGE_POLICY}
        onCancel={closeRowPhotoCrop}
        onApply={applyCroppedRowPhoto}
      />

      <ImageCropDialog
        open={Boolean(zipPhotoCrop)}
        aspectRatio={1}
        sourceUrl={zipPhotoCrop?.sourceUrl ?? ""}
        sourceFile={zipPhotoCrop?.photos[zipPhotoCrop.index]?.file}
        outputName={`manual-zip-${(zipPhotoCrop?.index ?? 0) + 1}.webp`}
        outputWidth={640}
        outputHeight={640}
        policy={MANUAL_MEMBER_IMAGE_POLICY}
        onCancel={cancelZipPhotoCrop}
        onApply={applyZipPhotoCrop}
      />
    </div>
  );
}
