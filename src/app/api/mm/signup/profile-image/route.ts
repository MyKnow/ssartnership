import { NextResponse } from "next/server";
import { MattermostApiError } from "@/lib/mattermost/client";
import { getMattermostCodeSession } from "@/lib/mattermost-code-session";
import { withActiveMattermostSenderForGeneration } from "@/lib/mattermost-senders/service";
import { normalizeMattermostProfileImage } from "@/lib/graduate-verification-files";

export const runtime = "nodejs";

export async function GET() {
  const signupSession = await getMattermostCodeSession("signup");
  if (!signupSession) {
    return NextResponse.json({ message: "Mattermost 가입 인증이 필요합니다." }, { status: 401 });
  }

  try {
    const image = await withActiveMattermostSenderForGeneration(
      signupSession.senderGeneration,
      (mattermost) => mattermost.getUserImage(signupSession.mmUserId),
    );
    const normalized = await normalizeMattermostProfileImage({
      contentType: image.contentType,
      source: image.bytes,
    });
    const responseBody = new Uint8Array(normalized.buffer.byteLength);
    responseBody.set(normalized.buffer);
    return new NextResponse(responseBody, {
      headers: {
        "content-type": normalized.contentType,
        "content-length": String(responseBody.byteLength),
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof MattermostApiError && error.code === "not_found") {
      return NextResponse.json({ message: "Mattermost 프로필 사진이 없습니다." }, { status: 404 });
    }
    return NextResponse.json(
      { message: "Mattermost 프로필 사진을 불러오지 못했습니다." },
      { status: 503 },
    );
  }
}
