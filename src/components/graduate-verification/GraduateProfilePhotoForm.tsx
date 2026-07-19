"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import ImageCropDialog from "@/components/media/ImageCropDialog";
import { useSingleImageUploadDraft } from "@/components/media/useSingleImageUploadDraft";
import { useToast } from "@/components/ui/Toast";
import {
  getImageUploadSourceError,
  prepareImageUploadSource,
} from "@/lib/image-upload/client-transform";
import { uploadImagesToStaging } from "@/lib/image-upload/client";
import {
  IMAGE_SOURCE_ACCEPT,
  resolveImageTransformPolicy,
} from "@/lib/image-upload/policy";
import { getMemberGateCompletionReturnTo } from "@/lib/member-required-gates";

const PROFILE_IMAGE_POLICY = resolveImageTransformPolicy("profile", "profile");

export default function GraduateProfilePhotoForm({
  returnTo,
}: {
  returnTo?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const sourceUrlRef = useRef<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const selectionRequestIdRef = useRef(0);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    variant: "error" | "info";
    text: string;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const router = useRouter();
  const { notify } = useToast();
  const { persist: persistDraft, clear: clearDraft } = useSingleImageUploadDraft({
    formKey: "member-profile-photo",
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
      setMessage({
        variant: "info",
        text: "임시 저장한 사진을 복원했습니다. 다시 제출할 수 있습니다.",
      });
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
      const url = URL.createObjectURL(sourceFile);
      sourceUrlRef.current = url;
      setSourceUrl(url);
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
            : "사진 변환에 실패했습니다.",
      });
    } finally {
      if (selectionRequestIdRef.current === requestId) {
        setSelecting(false);
      }
    }
  }

  function applyCroppedPhoto(nextFile: File) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(nextFile);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setFile(nextFile);
    setUploadId(null);
    setCropOpen(false);
    setMessage(null);
  }

  async function submit() {
    if (!file) {
      setMessage({
        variant: "error",
        text: "먼저 본인 사진을 선택하고 1:1 비율로 잘라 주세요.",
      });
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const stagedUploadId = uploadId ?? (await uploadImagesToStaging({
        purpose: "profile",
        actorMode: "member",
        uploads: [{ clientId: "profile", role: "profile", file }],
      }))[0]?.uploadId;
      if (!stagedUploadId) {
        throw new Error("사진 업로드 정보를 확인하지 못했습니다.");
      }
      setUploadId(stagedUploadId);
      await persistDraft(file, stagedUploadId);
      const response = await fetch("/api/certification/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId: stagedUploadId, uploadSource: "common" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message ?? "본인 사진 변경 요청을 저장하지 못했습니다.");
      }
      notify(
        "사진 변경 요청을 제출했습니다. 기존 승인 사진은 새 사진이 승인될 때까지 계속 표시됩니다.",
      );
      await clearDraft();
      router.replace(
        getMemberGateCompletionReturnTo(returnTo, "profile-photo"),
      );
    } catch (error) {
      setMessage({
        variant: "error",
        text:
          error instanceof Error
            ? error.message
            : "본인 사진 변경 요청을 저장하지 못했습니다.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1 text-sm text-muted-foreground">
        <p className="text-ko-pretty">
          새 사진은 관리자 적합성 검토 후 인증 카드에 반영됩니다.
        </p>
        <p className="text-ko-pretty">
          단체사진·로고·캐릭터·얼굴이 과도하게 가려진 사진은 사용할 수 없습니다.
        </p>
        <p className="text-ko-pretty">
          JPEG, PNG, WebP, AVIF, HEIC/HEIF, GIF, BMP, TIFF, SVG를 선택할 수 있으며, 크롭 적용 후 640×640 WebP 파일로 제출됩니다.
        </p>
      </div>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        aria-label="본인 사진 파일 선택"
        accept={IMAGE_SOURCE_ACCEPT}
        onChange={(event) => {
          void selectFile(event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
      />
      <div
        className={
          previewUrl
            ? "grid min-w-0 gap-4 rounded-[1.25rem] border border-border/70 bg-surface-inset p-4 min-[620px]:grid-cols-[minmax(0,1fr)_auto] min-[620px]:items-center"
            : "flex justify-end"
        }
      >
        {previewUrl ? (
          <figure className="flex min-w-0 flex-col items-center gap-3 text-center min-[620px]:flex-row min-[620px]:gap-4 min-[620px]:text-left">
            <Image
              src={previewUrl}
              alt="선택한 본인 사진 미리보기"
              width={144}
              height={144}
              unoptimized
              className="h-32 w-32 shrink-0 rounded-[1.125rem] border border-border bg-surface object-cover shadow-flat min-[620px]:h-36 min-[620px]:w-36"
            />
            <figcaption className="min-w-0 min-[620px]:min-w-20">
              <p className="text-ko whitespace-nowrap text-sm font-semibold text-foreground">선택한 사진</p>
              <p className="text-ko-pretty mt-1 text-xs leading-5 text-muted-foreground">
                1:1 비율로 잘린 사진이 제출됩니다.
              </p>
              <div className="mt-2.5 grid gap-1" role="status" aria-live="polite">
                <p className="text-ko text-xs font-semibold text-success">WebP 변환 완료</p>
                <p className="text-ko-pretty text-xs leading-5 text-muted-foreground">
                  640×640 WebP 파일로 제출됩니다. 원본 사진은 업로드되지 않습니다.
                </p>
              </div>
            </figcaption>
          </figure>
        ) : null}
        <div className="grid w-full gap-2 min-[400px]:grid-cols-2 min-[620px]:w-auto min-[620px]:flex min-[620px]:flex-wrap min-[620px]:justify-end">
          <Button
            className="min-w-0"
            variant="secondary"
            onClick={() => inputRef.current?.click()}
            loading={selecting}
            loadingText="사진 변환 중"
            disabled={pending}
          >
            {file ? "사진 다시 선택" : "본인 사진 선택"}
          </Button>
          <Button
            className="min-w-0"
            onClick={submit}
            loading={pending}
            loadingText="제출 중"
            disabled={selecting}
          >
            사진 변경 요청
          </Button>
        </div>
      </div>
      {message ? (
        <FormMessage variant={message.variant}>
          {message.text}
        </FormMessage>
      ) : null}
      <ImageCropDialog
        open={cropOpen}
        aspectRatio={1}
        sourceUrl={sourceUrl}
        sourceFile={sourceFile ?? undefined}
        outputName="graduate-profile.webp"
        outputWidth={640}
        outputHeight={640}
        policy={PROFILE_IMAGE_POLICY}
        onCancel={() => setCropOpen(false)}
        onApply={applyCroppedPhoto}
      />
    </div>
  );
}
