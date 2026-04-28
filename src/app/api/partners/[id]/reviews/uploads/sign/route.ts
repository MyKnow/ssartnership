import { NextResponse } from "next/server";
import { createSignedReviewMediaUpload } from "@/lib/review-media-storage";
import {
  ensureVisibleReviewPartner,
  getReviewMemberSession,
  parseRequestedReviewId,
} from "../../_shared";

export const runtime = "nodejs";

const MAX_REVIEW_IMAGE_COUNT = 5;
const MAX_REVIEW_IMAGE_BYTES = 2 * 1024 * 1024;

type UploadRequest = {
  reviewId?: unknown;
  files?: unknown;
};

type UploadFileRequest = {
  clientId: string;
  type: string;
  size: number;
};

function parseUploadFiles(value: unknown): UploadFileRequest[] | null {
  if (!Array.isArray(value) || value.length > MAX_REVIEW_IMAGE_COUNT) {
    return null;
  }

  const files = value.map((item) => {
    if (!item || typeof item !== "object") {
      return null;
    }

    const record = item as Record<string, unknown>;
    const clientId = typeof record.clientId === "string" ? record.clientId.trim() : "";
    const type = typeof record.type === "string" ? record.type.trim() : "";
    const size = typeof record.size === "number" ? record.size : Number(record.size);

    if (!clientId || !type.startsWith("image/") || !Number.isFinite(size)) {
      return null;
    }
    if (size <= 0 || size > MAX_REVIEW_IMAGE_BYTES) {
      return null;
    }

    return { clientId, type, size };
  });

  if (files.some((item) => item === null)) {
    return null;
  }

  return files as UploadFileRequest[];
}

function parseReviewIdFromBody(value: unknown) {
  const formData = new FormData();
  if (typeof value === "string") {
    formData.set("reviewId", value);
  }
  return parseRequestedReviewId(formData);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await getReviewMemberSession().catch(() => null);
  if (!session?.userId) {
    return NextResponse.json(
      { ok: false, message: "로그인 후 리뷰 사진을 업로드할 수 있습니다." },
      { status: 401 },
    );
  }

  const partner = await ensureVisibleReviewPartner(id, session.userId);
  if (!partner) {
    return NextResponse.json({ ok: false, message: "대상을 찾을 수 없습니다." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as UploadRequest | null;
  const reviewId = parseReviewIdFromBody(body?.reviewId);
  const files = parseUploadFiles(body?.files);
  if (!reviewId || !files) {
    return NextResponse.json(
      { ok: false, message: "리뷰 사진 업로드 요청을 확인해 주세요." },
      { status: 400 },
    );
  }

  try {
    const uploads = await Promise.all(
      files.map(async (file, index) => ({
        clientId: file.clientId,
        ...(await createSignedReviewMediaUpload(id, reviewId, index)),
      })),
    );

    return NextResponse.json({ ok: true, uploads });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "리뷰 사진 업로드 URL 발급에 실패했습니다.";
    return NextResponse.json({ ok: false, message }, { status: 503 });
  }
}
