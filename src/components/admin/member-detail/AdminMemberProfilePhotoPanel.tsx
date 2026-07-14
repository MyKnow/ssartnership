"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ImageCropDialog from "@/components/media/ImageCropDialog";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import { MAX_GRADUATE_PROFILE_IMAGE_BYTES } from "@/lib/graduate-verification";
import type { MemberProfilePhotoReviewStatus } from "@/lib/member-profile-images";

type FormAction = (formData: FormData) => void | Promise<void>;

type SignedUpload = { uploadId: string; signedUrl: string };

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

function validatePhoto(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "사진은 JPEG, PNG, WebP 파일만 선택할 수 있습니다.";
  }
  if (file.size <= 0 || file.size > MAX_GRADUATE_PROFILE_IMAGE_BYTES) {
    return "사진은 5MB 이하만 선택할 수 있습니다.";
  }
  return null;
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
  const [sourceUrl, setSourceUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => () => {
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  function selectFile(nextFile: File | null) {
    if (!nextFile) return;
    const error = validatePhoto(nextFile);
    if (error) {
      setMessage(error);
      return;
    }
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    const nextSourceUrl = URL.createObjectURL(nextFile);
    sourceUrlRef.current = nextSourceUrl;
    setSourceUrl(nextSourceUrl);
    setCropOpen(true);
    setMessage(null);
  }

  function applyCroppedPhoto(nextFile: File) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextPreviewUrl = URL.createObjectURL(nextFile);
    previewUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
    setFile(nextFile);
    setCropOpen(false);
  }

  async function submitReplacement() {
    if (!file) {
      setMessage("사진을 선택하고 1:1 비율로 잘라 주세요.");
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const signResponse = await fetch(`/api/admin/members/${encodeURIComponent(memberId)}/profile-photo/sign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentType: file.type, size: file.size }),
      });
      const signData = await signResponse.json().catch(() => ({}));
      if (!signResponse.ok || !signData.upload) {
        throw new Error(signData.message ?? "사진 업로드 준비에 실패했습니다.");
      }
      const upload = signData.upload as SignedUpload;
      const uploadResponse = await fetch(upload.signedUrl, {
        method: "PUT",
        headers: { "content-type": file.type, "x-upsert": "false" },
        body: file,
      });
      if (!uploadResponse.ok) throw new Error("사진 업로드에 실패했습니다.");

      const submitResponse = await fetch(`/api/admin/members/${encodeURIComponent(memberId)}/profile-photo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uploadId: upload.uploadId }),
      });
      const submitData = await submitResponse.json().catch(() => ({}));
      if (!submitResponse.ok || !submitData.ok) {
        throw new Error(submitData.message ?? "사진 변경 요청을 저장하지 못했습니다.");
      }
      setMessage("새 사진을 검토 대기 상태로 등록했습니다. 승인 전까지 인증 카드와 QR은 제한됩니다.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "사진 변경 요청을 저장하지 못했습니다.");
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

      <p className="text-sm text-muted-foreground">
        관리자가 올린 사진도 검토 대기로 등록됩니다. 사진을 반려하면 새 사진이 승인될 때까지 인증 카드와 QR을 사용할 수 없습니다.
      </p>

      {canUpdate ? (
        <>
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            aria-label="새 프로필 사진 파일 선택"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              selectFile(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            {previewUrl ? <Image src={previewUrl} alt="새 프로필 사진 미리보기" width={64} height={64} unoptimized className="h-16 w-16 rounded-2xl border border-border object-cover" /> : null}
            <Button variant="secondary" type="button" disabled={pending} onClick={() => inputRef.current?.click()}>
              {file ? "사진 다시 선택" : "새 사진 선택"}
            </Button>
            <Button type="button" disabled={!file || pending} loading={pending} loadingText="등록 중" onClick={() => void submitReplacement()}>
              사진 변경 요청
            </Button>
          </div>

          {pendingImageId ? (
            <div className="grid gap-3 rounded-2xl border border-border bg-surface-inset p-3">
              <div className="flex items-center gap-3">
                <Image src={`/api/admin/profile-photos/images/${encodeURIComponent(pendingImageId)}`} alt="검토 대기 중인 새 프로필 사진" width={64} height={64} unoptimized className="h-16 w-16 rounded-2xl border border-border object-cover" />
                <p className="text-sm text-muted-foreground">새 사진이 검토 대기 중입니다. 검토 결과는 감사 로그에 남습니다.</p>
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

      {message ? <FormMessage variant={message.includes("등록했습니다") ? "info" : "error"}>{message}</FormMessage> : null}
      <ImageCropDialog
        open={cropOpen}
        title="프로필 사진 자르기"
        subtitle="얼굴이 선명하게 보이도록 1:1 비율로 맞춰 주세요."
        aspectRatio={1}
        sourceUrl={sourceUrl}
        outputName="member-profile.webp"
        outputWidth={640}
        outputHeight={640}
        accept="image/jpeg,image/png,image/webp"
        validateFile={validatePhoto}
        onCancel={() => setCropOpen(false)}
        onApply={applyCroppedPhoto}
      />
    </Card>
  );
}
