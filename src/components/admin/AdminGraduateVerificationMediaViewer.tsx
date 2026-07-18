"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import LightboxModal from "@/components/partner-image-carousel/LightboxModal";
import { clampCarouselZoom } from "@/components/partner-image-carousel/helpers";
import type { CarouselOffset } from "@/components/partner-image-carousel/types";

const MAX_CERTIFICATE_PAGES = 5;
const CERTIFICATE_RENDER_SCALE = 1.6;

type ActiveMedia = "certificate" | "profile" | null;
type CertificateState = "idle" | "loading" | "ready" | "error";

function revokeObjectUrls(urls: string[]) {
  urls.forEach((url) => URL.revokeObjectURL(url));
}

async function renderCertificatePages(sourceUrl: string, signal: AbortSignal) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const response = await fetch(sourceUrl, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    throw new Error("수료증 파일을 불러오지 못했습니다.");
  }

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await response.arrayBuffer()),
    isEvalSupported: false,
    useWorkerFetch: false,
  });
  const document = await loadingTask.promise;
  const objectUrls: string[] = [];

  try {
    if (document.numPages < 1 || document.numPages > MAX_CERTIFICATE_PAGES) {
      throw new Error("수료증 페이지 수를 확인할 수 없습니다.");
    }

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      if (signal.aborted) {
        throw new DOMException("렌더링이 취소되었습니다.", "AbortError");
      }

      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: CERTIFICATE_RENDER_SCALE });
      const canvas = window.document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) {
        throw new Error("수료증 이미지를 준비하지 못했습니다.");
      }

      await page.render({ canvasContext: context, viewport }).promise;
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (nextBlob) => {
            if (nextBlob) {
              resolve(nextBlob);
            } else {
              reject(new Error("수료증 이미지를 생성하지 못했습니다."));
            }
          },
          "image/webp",
          0.9,
        );
      });
      objectUrls.push(URL.createObjectURL(blob));
      canvas.width = 0;
      canvas.height = 0;
    }

    return objectUrls;
  } catch (error) {
    revokeObjectUrls(objectUrls);
    throw error;
  } finally {
    await document.destroy();
  }
}

export default function AdminGraduateVerificationMediaViewer({
  requestId,
  profileImageId,
}: {
  requestId: string;
  profileImageId: string | null;
}) {
  const [activeMedia, setActiveMedia] = useState<ActiveMedia>(null);
  const [viewerRequest, setViewerRequest] = useState(0);
  const [certificatePages, setCertificatePages] = useState<string[]>([]);
  const [certificatePage, setCertificatePage] = useState(0);
  const [certificateState, setCertificateState] = useState<CertificateState>("idle");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<CarouselOffset>({ x: 0, y: 0 });
  const dragStartRef = useRef<CarouselOffset>({ x: 0, y: 0 });
  const offsetStartRef = useRef<CarouselOffset>({ x: 0, y: 0 });
  const portalRoot = typeof document === "undefined" ? null : document.body;

  const certificateUrl = `/api/admin/graduate-verifications/${encodeURIComponent(requestId)}/certificate`;
  const profileImageUrl = profileImageId
    ? `/api/admin/graduate-verifications/images/${encodeURIComponent(profileImageId)}`
    : null;

  useEffect(() => {
    if (activeMedia !== "certificate") {
      return;
    }

    const controller = new AbortController();
    let renderedObjectUrls: string[] = [];
    void renderCertificatePages(certificateUrl, controller.signal)
      .then((nextPages) => {
        if (controller.signal.aborted) {
          revokeObjectUrls(nextPages);
          return;
        }
        renderedObjectUrls = nextPages;
        setCertificatePages(nextPages);
        setCertificateState("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        setCertificateState("error");
      });

    return () => {
      controller.abort();
      revokeObjectUrls(renderedObjectUrls);
    };
  }, [activeMedia, certificateUrl, viewerRequest]);

  function openMedia(nextMedia: Exclude<ActiveMedia, null>) {
    setActiveMedia(nextMedia);
    setViewerRequest((previous) => previous + 1);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    if (nextMedia === "certificate") {
      setCertificatePages([]);
      setCertificatePage(0);
      setCertificateState("loading");
    }
  }

  function navigateCertificatePage(direction: -1 | 1) {
    setCertificatePage((previous) => (previous + direction + certificatePages.length) % certificatePages.length);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  function handlePanStart(x: number, y: number) {
    dragStartRef.current = { x, y };
    offsetStartRef.current = { ...offset };
  }

  function handlePanMove(x: number, y: number) {
    setOffset({
      x: offsetStartRef.current.x + x - dragStartRef.current.x,
      y: offsetStartRef.current.y + y - dragStartRef.current.y,
    });
  }

  function handleZoomChange(value: number | ((previous: number) => number)) {
    setZoom((previous) => {
      const nextValue = typeof value === "function" ? value(previous) : value;
      return clampCarouselZoom(nextValue);
    });
  }

  const activeImage = activeMedia === "profile"
    ? profileImageUrl ?? ""
    : certificatePages[certificatePage] ?? "";
  const isCertificateLoading = activeMedia === "certificate" && certificateState === "loading";
  const isCertificateError = activeMedia === "certificate" && certificateState === "error";
  const mediaName = activeMedia === "certificate" ? "수료증 이미지 미리보기" : "본인 사진 미리보기";

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-[1rem] border border-border px-3 text-sm font-semibold hover:bg-surface-inset"
          aria-haspopup="dialog"
          onClick={() => openMedia("certificate")}
        >
          수료증 보기
        </button>
        {profileImageUrl ? (
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-[1rem] border border-border px-3 text-sm font-semibold hover:bg-surface-inset"
            aria-haspopup="dialog"
            onClick={() => openMedia("profile")}
          >
            사진 보기
          </button>
        ) : null}
      </div>

      {portalRoot && activeMedia
        ? createPortal(
            <LightboxModal
              open
              canNavigate={activeMedia === "certificate" && certificatePages.length > 1}
              activeImage={activeImage}
              name={mediaName}
              navigationUnit={activeMedia === "certificate" ? "페이지" : "사진"}
              zoom={zoom}
              offset={offset}
              onClose={() => setActiveMedia(null)}
              onPrev={() => navigateCertificatePage(-1)}
              onNext={() => navigateCertificatePage(1)}
              onZoomChange={handleZoomChange}
              onOffsetChange={setOffset}
              onPanStart={handlePanStart}
              onPanMove={handlePanMove}
              onPanEnd={() => undefined}
              fallback={
                isCertificateLoading ? (
                  <p role="status">수료증을 이미지로 준비하고 있습니다.</p>
                ) : isCertificateError ? (
                  <p role="alert">수료증 이미지를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
                ) : (
                  <p role="alert">이미지를 불러오지 못했습니다.</p>
                )
              }
            />,
            portalRoot,
          )
        : null}
    </>
  );
}
