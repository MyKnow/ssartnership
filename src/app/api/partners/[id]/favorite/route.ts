import { NextResponse } from "next/server";
import { partnerFavoriteRepository, partnerRepository } from "@/lib/repositories";
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
      { message: "유효한 브랜드를 찾을 수 없습니다." },
      { status: 400 },
    );
  }

  const exists = await partnerRepository.partnerExists(partnerId);
  if (!exists) {
    return NextResponse.json(
      { message: "유효한 브랜드를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  let payload: { favorite?: unknown };
  try {
    payload = (await request.json()) as { favorite?: unknown };
  } catch {
    return NextResponse.json(
      { message: "잘못된 요청입니다." },
      { status: 400 },
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
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "즐겨찾기를 처리하지 못했습니다.",
      },
      { status: 500 },
    );
  }
}
