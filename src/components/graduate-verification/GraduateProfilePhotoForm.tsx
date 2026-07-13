"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import ImageCropDialog from "@/components/media/ImageCropDialog";
import { MAX_GRADUATE_PROFILE_IMAGE_BYTES } from "@/lib/graduate-verification";

type SignedUpload = {
  uploadId: string;
  signedUrl: string;
};

function validatePhoto(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return "본인 사진은 JPEG, PNG, WebP 파일만 선택할 수 있습니다.";
  }
  if (file.size <= 0 || file.size > MAX_GRADUATE_PROFILE_IMAGE_BYTES) {
    return "본인 사진은 5MB 이하만 선택할 수 있습니다.";
  }
  return null;
}

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

export default function GraduateProfilePhotoForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const sourceUrlRef = useRef<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
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
    const url = URL.createObjectURL(nextFile);
    sourceUrlRef.current = url;
    setSourceUrl(url);
    setCropOpen(true);
    setMessage(null);
  }

  function applyCroppedPhoto(nextFile: File) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(nextFile);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setFile(nextFile);
    setCropOpen(false);
  }

  async function submit() {
    if (!file) {
      setMessage("먼저 본인 사진을 선택하고 1:1 비율로 잘라 주세요.");
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
      setMessage("사진 변경 요청을 제출했습니다. 기존 승인 사진은 새 사진이 승인될 때까지 계속 표시됩니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "본인 사진 변경 요청을 저장하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        새 사진은 관리자 적합성 검토 후 인증 카드에 반영됩니다. 단체사진·로고·캐릭터·얼굴이 과도하게 가려진 사진은 사용할 수 없습니다.
      </p>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        aria-label="본인 사진 파일 선택"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => {
          selectFile(event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt="선택한 본인 사진"
            width={96}
            height={96}
            unoptimized
            className="h-24 w-24 rounded-card border border-border object-cover"
          />
        ) : null}
        <Button variant="secondary" onClick={() => inputRef.current?.click()}>
          {file ? "사진 다시 선택" : "본인 사진 선택"}
        </Button>
        <Button onClick={submit} loading={pending} loadingText="제출 중">
          사진 변경 요청
        </Button>
      </div>
      {message ? (
        <FormMessage variant={message.includes("제출했습니다") ? "info" : "error"}>
          {message}
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
        accept="image/jpeg,image/png,image/webp"
        validateFile={validatePhoto}
        onCancel={() => setCropOpen(false)}
        onApply={applyCroppedPhoto}
      />
    </div>
  );
}
