"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ImageCropDialog from "@/components/media/ImageCropDialog";
import { useSingleImageUploadDraft } from "@/components/media/useSingleImageUploadDraft";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import {
  getImageUploadSourceError,
  prepareImageUploadSource,
} from "@/lib/image-upload/client-transform";
import { uploadImagesToStaging } from "@/lib/image-upload/client";
import {
  IMAGE_SOURCE_ACCEPT,
  resolveImageTransformPolicy,
} from "@/lib/image-upload/policy";
import type { MemberProfilePhotoReviewStatus } from "@/lib/member-profile-images";

type FormAction = (formData: FormData) => void | Promise<void>;

type Message = { variant: "error" | "info"; text: string };
const PROFILE_IMAGE_POLICY = resolveImageTransformPolicy("profile", "profile");

const REVIEW_STATUS_LABEL: Record<MemberProfilePhotoReviewStatus, string> = {
  missing: "사진 없음",
  approved: "승인됨",
  pending: "검토 대기",
  rejected: "반려됨",
};

function getStatusVariant(status: MemberProfilePhotoReviewStatus) {
  if (status === "approved") return "success" as const;
  if (status === "pending") return "warning" as const;
  if (status === "rejected") return "danger" as const;
  return "neutral" as const;
}

export default function AdminMemberProfilePhotoPanel({
  memberId,
  reviewStatus,
  pendingImageId,
  canUpdate,
  approveAction,
  rejectReplacementAction,
  rejectCurrentAction,
}: {
  memberId: string;
  reviewStatus: MemberProfilePhotoReviewStatus;
  pendingImageId: string | null;
  canUpdate: boolean;
  approveAction: FormAction;
  rejectReplacementAction: FormAction;
  rejectCurrentAction: FormAction;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const sourceUrlRef = useRef<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const selectionRequestIdRef = useRef(0);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [pending, setPending] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const { persist: persistDraft, clear: clearDraft } = useSingleImageUploadDraft({
    formKey: `admin-member-profile-${memberId}`,
    role: "profile",
    file,
    uploadId,
    onRestore: (restored) => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const restoredPreviewUrl = URL.createObjectURL(restored.file);
      previewUrlRef.current = restoredPreviewUrl;
      setPreviewUrl(restoredPreviewUrl);
      setFile(restored.file);
      setUploadId(restored.uploadId ?? null);
      setMessage({ variant: "info", text: "임시 저장한 사진을 복원했습니다. 다시 변경할 수 있습니다." });
    },
  });

  useEffect(() => () => {
    selectionRequestIdRef.current += 1;
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  async function selectFile(nextFile: File | null) {
    if (!nextFile) return;
    const error = getImageUploadSourceError(nextFile, PROFILE_IMAGE_POLICY);
    if (error) {
      setMessage({ variant: "error", text: error });
      return;
    }
    const requestId = selectionRequestIdRef.current + 1;
    selectionRequestIdRef.current = requestId;
    setSelecting(true);
    setMessage(null);
    try {
      const sourceFile = await prepareImageUploadSource(nextFile, PROFILE_IMAGE_POLICY);
      if (selectionRequestIdRef.current !== requestId) return;
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
      const nextSourceUrl = URL.createObjectURL(sourceFile);
      sourceUrlRef.current = nextSourceUrl;
      setSourceUrl(nextSourceUrl);
      setSourceFile(sourceFile);
      setCropOpen(true);
      setMessage(null);
    } catch (nextError) {
      if (selectionRequestIdRef.current !== requestId) return;
      setMessage({
        variant: "error",
        text:
          nextError instanceof Error && nextError.message
            ? nextError.message
            : "사진을 안전하게 준비하지 못했습니다.",
      });
    } finally {
      if (selectionRequestIdRef.current === requestId) {
        setSelecting(false);
      }
    }
  }

  function applyCroppedPhoto(nextFile: File) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextPreviewUrl = URL.createObjectURL(nextFile);
    previewUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
    setFile(nextFile);
    setUploadId(null);
    setCropOpen(false);
    setMessage(null);
  }

  async function submitReplacement() {
    if (!file) {
      setMessage({ variant: "error", text: "사진을 선택하고 1:1 비율로 잘라 주세요." });
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const stagedUploadId = uploadId ?? (await uploadImagesToStaging({
        purpose: "profile",
        actorMode: "admin",
        uploads: [{ clientId: `member-${memberId}`, role: "profile", file }],
      }))[0]?.uploadId;
      if (!stagedUploadId) {
        throw new Error("사진 업로드 정보를 확인하지 못했습니다.");
      }
      setUploadId(stagedUploadId);
      await persistDraft(file, stagedUploadId);

      const submitResponse = await fetch(`/api/admin/members/${encodeURIComponent(memberId)}/profile-photo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uploadId: stagedUploadId, uploadSource: "common" }),
      });
      const submitData = await submitResponse.json().catch(() => ({}));
      if (!submitResponse.ok || !submitData.ok) {
        throw new Error(submitData.message ?? "사진을 변경하지 못했습니다.");
      }
      setMessage({
        variant: "info",
        text: "사진을 변경했습니다. 인증 카드와 QR에 바로 반영됩니다.",
      });
      await clearDraft();
      router.refresh();
    } catch (error) {
      setMessage({
        variant: "error",
        text: error instanceof Error ? error.message : "사진을 변경하지 못했습니다.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card tone="elevated" className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="ui-kicker">Profile photo</p>
          <h2 className="text-lg font-semibold">프로필 사진 관리</h2>
        </div>
        <Badge variant={getStatusVariant(reviewStatus)}>{REVIEW_STATUS_LABEL[reviewStatus]}</Badge>
      </div>

      <div className="space-y-1 text-sm text-muted-foreground">
        <p className="text-ko-pretty">
          관리자가 직접 변경한 사진은 인증 카드와 QR에 바로 반영됩니다.
        </p>
        <p className="text-ko-pretty">
          선택한 원본은 기기에서 WebP로 압축·정규화하고 서버에서 다시 검증합니다.
        </p>
      </div>

      {canUpdate ? (
        <>
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            aria-label="새 프로필 사진 파일 선택"
            accept={IMAGE_SOURCE_ACCEPT}
            disabled={pending || selecting}
            onChange={(event) => {
              void selectFile(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
          />
          <div
            className={
              previewUrl
                ? "grid min-w-0 gap-4 rounded-[1.25rem] border border-border/70 bg-surface-inset p-4 min-[560px]:grid-cols-[minmax(0,1fr)_auto] min-[560px]:items-center"
                : "flex min-w-0 justify-end"
            }
          >
            {previewUrl ? (
              <figure className="flex min-w-0 flex-col items-center gap-3 text-center min-[560px]:flex-row min-[560px]:gap-4 min-[560px]:text-left">
                <Image
                  src={previewUrl}
                  alt="변경할 프로필 사진 미리보기"
                  width={144}
                  height={144}
                  unoptimized
                  className="h-32 w-32 shrink-0 rounded-[1.125rem] border border-border bg-surface object-cover shadow-flat min-[560px]:h-36 min-[560px]:w-36"
                />
                <figcaption className="min-w-0 min-[560px]:min-w-20">
                  <p className="text-ko whitespace-nowrap text-sm font-semibold text-foreground">변경할 사진</p>
                  <p className="text-ko-pretty mt-1 text-xs leading-5 text-muted-foreground">
                    1:1 비율 WebP 사진으로 바로 반영됩니다.
                  </p>
                </figcaption>
              </figure>
            ) : null}
            <div className="grid w-full min-w-0 gap-2 min-[400px]:grid-cols-2 min-[560px]:w-auto min-[560px]:flex min-[560px]:flex-wrap min-[560px]:justify-end">
              <Button
                className="min-w-0"
                variant="secondary"
                type="button"
                disabled={pending}
                loading={selecting}
                loadingText="사진 준비 중"
                onClick={() => inputRef.current?.click()}
              >
                {file ? "다시 선택" : "사진 선택"}
              </Button>
              <Button
                className="min-w-0"
                type="button"
                disabled={!file || pending || selecting}
                loading={pending}
                loadingText="변경 중"
                onClick={() => void submitReplacement()}
              >
                사진 변경
              </Button>
            </div>
          </div>

          {pendingImageId ? (
            <div className="grid gap-3 rounded-2xl border border-border bg-surface-inset p-3">
              <div className="flex items-center gap-3">
                <Image src={`/api/admin/profile-photos/images/${encodeURIComponent(pendingImageId)}`} alt="검토 대기 중인 새 프로필 사진" width={64} height={64} unoptimized className="h-16 w-16 rounded-2xl border border-border object-cover" />
                <p className="text-ko-pretty min-w-0 text-sm text-muted-foreground">회원이 제출한 사진이 검토 대기 중입니다. 검토 결과는 감사 로그에 남습니다.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <form action={approveAction}>
                  <input type="hidden" name="imageId" value={pendingImageId} />
                  <input type="hidden" name="memberId" value={memberId} />
                  <Button type="submit" className="w-full">사진 승인</Button>
                </form>
                <form action={rejectReplacementAction} className="grid gap-2">
                  <input type="hidden" name="imageId" value={pendingImageId} />
                  <input type="hidden" name="memberId" value={memberId} />
                  <label className="sr-only" htmlFor={`member-photo-reject-${pendingImageId}`}>반려 사유</label>
                  <input id={`member-photo-reject-${pendingImageId}`} name="reason" required maxLength={500} className="h-11 rounded-[1rem] border border-border bg-surface px-3 text-sm" placeholder="반려 사유" />
                  <Button variant="danger" type="submit">새 사진 반려</Button>
                </form>
              </div>
            </div>
          ) : null}

          {reviewStatus === "approved" ? (
            <form action={rejectCurrentAction} className="grid gap-2 rounded-2xl border border-danger/30 bg-danger/5 p-3">
              <input type="hidden" name="memberId" value={memberId} />
              <label className="text-sm font-medium" htmlFor={`member-current-photo-reject-${memberId}`}>현재 사진 반려 사유</label>
              <input id={`member-current-photo-reject-${memberId}`} name="reason" required maxLength={500} className="h-11 rounded-[1rem] border border-border bg-surface px-3 text-sm" placeholder="사진 반려 사유" />
              <Button variant="danger" type="submit">현재 사진 반려 및 인증 중지</Button>
            </form>
          ) : null}
        </>
      ) : <p className="text-sm text-muted-foreground">사진 조회 권한만 있어 변경·승인·반려는 할 수 없습니다.</p>}

      {message ? <FormMessage variant={message.variant}>{message.text}</FormMessage> : null}
      <ImageCropDialog
        open={cropOpen}
        aspectRatio={1}
        sourceUrl={sourceUrl}
        sourceFile={sourceFile ?? undefined}
        outputName="admin-member-profile.webp"
        outputWidth={640}
        outputHeight={640}
        policy={PROFILE_IMAGE_POLICY}
        onCancel={() => setCropOpen(false)}
        onApply={applyCroppedPhoto}
      />
    </Card>
  );
}
