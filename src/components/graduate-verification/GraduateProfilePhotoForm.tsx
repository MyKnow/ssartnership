"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import ImageCropDialog from "@/components/media/ImageCropDialog";
import { useToast } from "@/components/ui/Toast";
import {
  GRADUATE_PROFILE_PHOTO_ACCEPT,
  getGraduateProfilePhotoSourceError,
  getGraduateProfilePhotoSourceFormat,
  normalizeGraduateProfilePhotoSource,
} from "@/lib/graduate-profile-photo.client";
import { getMemberGateCompletionReturnTo } from "@/lib/member-required-gates";

type SignedUpload = {
  uploadId: string;
  signedUrl: string;
};

async function uploadReplacementPhoto(file: File) {
  const signResponse = await fetch("/api/certification/photo/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: file.type, size: file.size }),
  });
  const signData = await signResponse.json().catch(() => ({}));
  if (!signResponse.ok || !signData.upload) {
    throw new Error(signData.message ?? "사진 업로드 준비에 실패했습니다.");
  }
  const upload = signData.upload as SignedUpload;
  const uploadResponse = await fetch(upload.signedUrl, {
    method: "PUT",
    headers: {
      "content-type": file.type,
      "x-upsert": "false",
    },
    body: file,
  });
  if (!uploadResponse.ok) {
    throw new Error("사진 업로드에 실패했습니다.");
  }
  return upload.uploadId;
}

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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{
    variant: "error" | "info";
    text: string;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const router = useRouter();
  const { notify } = useToast();

  useEffect(() => () => {
    selectionRequestIdRef.current += 1;
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  async function selectFile(nextFile: File | null) {
    if (!nextFile) return;
    const error = getGraduateProfilePhotoSourceError(nextFile);
    if (error) {
      setMessage({ variant: "error", text: error });
      return;
    }
    const requestId = selectionRequestIdRef.current + 1;
    selectionRequestIdRef.current = requestId;
    const isHeif = getGraduateProfilePhotoSourceFormat(nextFile) === "heif";
    setSelecting(true);
    setMessage(
      isHeif
        ? {
            variant: "info",
            text: "HEIC/HEIF 사진을 기기에서 안전하게 변환하고 있습니다.",
          }
        : null,
    );
    try {
      const sourceFile = await normalizeGraduateProfilePhotoSource(nextFile);
      if (selectionRequestIdRef.current !== requestId) return;
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
      const url = URL.createObjectURL(sourceFile);
      sourceUrlRef.current = url;
      setSourceUrl(url);
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
      const uploadId = await uploadReplacementPhoto(file);
      const response = await fetch("/api/certification/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message ?? "본인 사진 변경 요청을 저장하지 못했습니다.");
      }
      notify(
        "사진 변경 요청을 제출했습니다. 기존 승인 사진은 새 사진이 승인될 때까지 계속 표시됩니다.",
      );
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
          JPEG, PNG, WebP, HEIC, HEIF를 선택할 수 있으며, 크롭 적용 후 640×640 WebP 파일로 제출됩니다.
        </p>
      </div>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        aria-label="본인 사진 파일 선택"
        accept={GRADUATE_PROFILE_PHOTO_ACCEPT}
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
        title="본인 사진 자르기"
        subtitle="얼굴이 분명하게 보이도록 1:1 비율로 맞춰 주세요."
        aspectRatio={1}
        sourceUrl={sourceUrl}
        outputName="graduate-profile.webp"
        outputWidth={640}
        outputHeight={640}
        accept={GRADUATE_PROFILE_PHOTO_ACCEPT}
        validateFile={getGraduateProfilePhotoSourceError}
        prepareFile={normalizeGraduateProfilePhotoSource}
        onCancel={() => setCropOpen(false)}
        onApply={applyCroppedPhoto}
      />
    </div>
  );
}
