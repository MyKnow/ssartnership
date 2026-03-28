import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { deletePushMessageLog } from "@/lib/push";

export const runtime = "nodejs";

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
  }

  if (!(await isAdminSession())) {
    return NextResponse.json(
      { message: "관리자 인증이 필요합니다." },
      { status: 401 },
    );
  }

  try {
    const { id } = await context.params;
    await deletePushMessageLog(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "푸시 메시지 로그 삭제에 실패했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
