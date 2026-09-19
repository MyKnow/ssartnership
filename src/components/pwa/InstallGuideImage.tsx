"use client";

import Image from "next/image";
import { useState } from "react";
import Button from "@/components/ui/Button";

export default function InstallGuideImage({
  src,
  alt,
  objectPosition,
}: {
  src: string;
  alt: string;
  objectPosition: string;
}) {
  const [original, setOriginal] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  return (
    <div
      data-install-guide-image
      className="relative h-44 min-w-0 overflow-hidden rounded-[1rem] border border-border bg-surface-control shadow-flat md:h-full md:min-h-44"
    >
      {status === "error" ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-3 text-center">
          <p role="status" className="text-sm text-muted-foreground">
            안내 이미지를 불러오지 못했어요.
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              setAttempt(value => value + 1);
              setStatus("loading");
            }}
          >
            이미지 다시 불러오기
          </Button>
        </div>
      ) : (
        <>
          {status === "loading" ? (
            <span className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
              안내 이미지 불러오는 중…
            </span>
          ) : null}
          <Image
            key={`${src}:${original}:${attempt}`}
            src={attempt > 0 ? `${src}?retry=${attempt}` : src}
            alt={alt}
            fill
            sizes="(min-width: 768px) 240px, calc(100vw - 80px)"
            className="object-cover"
            style={{ objectPosition }}
            unoptimized={original}
            onLoad={() => setStatus("loaded")}
            onError={() => {
              // 변환 요청만 실패한 경우에는 각 안내 이미지의 정적 원본으로 한 번 복구합니다.
              if (!original) setOriginal(true);
              else setStatus("error");
            }}
          />
        </>
      )}
    </div>
  );
}
