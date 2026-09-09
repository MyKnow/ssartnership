import { NextResponse } from "next/server";
import { getSafePublicRouteError } from "@/lib/public-route-safe-errors";
import { partnerFavoriteRepository, partnerRepository } from "@/lib/repositories";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { MAX_STANDARD_JSON_BODY_BYTES } from "@/lib/request-body-limit";
import {
  RouteJsonBodyError,
  readRouteJsonBodyWithinLimit,
} from "@/lib/route-json-body";
import { getSignedUserSession } from "@/lib/user-auth";

function safeDecodeSegment(value: string) {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return "";
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (
    !isTrustedSameOriginRequest(request, {
      allowedContentTypes: ["application/json"],
    })
  ) {
    return NextResponse.json(
      { message: "잘못된 요청입니다." },
      { status: 403 },
    );
  }

  const session = await getSignedUserSession();
  if (!session?.userId) {
    return NextResponse.json(
      { message: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  const resolvedParams = await params;
  const partnerId = resolvedParams?.id ? safeDecodeSegment(resolvedParams.id) : "";
  if (!partnerId) {
    return NextResponse.json(
      { message: "유효한 제휴처를 찾을 수 없습니다." },
      { status: 400 },
    );
  }

  const exists = await partnerRepository.partnerExists(partnerId);
  if (!exists) {
    return NextResponse.json(
      { message: "유효한 제휴처를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  let payload: { favorite?: unknown };
  try {
    payload = await readRouteJsonBodyWithinLimit<{ favorite?: unknown }>(
      request,
      {
        maximumBytes: MAX_STANDARD_JSON_BODY_BYTES,
        invalidMessage: "잘못된 요청입니다.",
        tooLargeMessage: "요청이 너무 큽니다.",
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof RouteJsonBodyError
          ? error.message
          : "잘못된 요청입니다.",
      },
      { status: error instanceof RouteJsonBodyError ? error.status : 400 },
    );
  }

  if (typeof payload.favorite !== "boolean") {
    return NextResponse.json(
      { message: "즐겨찾기 상태가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  try {
    await partnerFavoriteRepository.setMemberFavorite(
      session.userId,
      partnerId,
      payload.favorite,
    );
    return NextResponse.json({ favorite: payload.favorite });
  } catch (error) {
    console.error("[partner-favorite] update failed", error);
    const safeError = getSafePublicRouteError(
      error,
      "즐겨찾기를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
    return NextResponse.json(
      { message: safeError.message },
      { status: safeError.status },
    );
  }
}
