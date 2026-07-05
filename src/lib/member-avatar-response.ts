import { NextResponse } from "next/server";
import {
  resolveMemberAvatarSource,
  type MemberAvatarInput,
} from "@/lib/member-avatar";

type MemberAvatarResponseOptions = {
  cacheControl?: string;
  lastModified?: string | null;
};

export function createMemberAvatarResponse(
  input: MemberAvatarInput,
  options: MemberAvatarResponseOptions = {},
) {
  const cacheControl = options.cacheControl ?? "private, max-age=300";
  const resolved = resolveMemberAvatarSource(input);

  if (resolved.kind === "redirect") {
    const response = NextResponse.redirect(resolved.url, 302);
    response.headers.set("cache-control", cacheControl);
    return response;
  }

  if (resolved.kind === "missing") {
    return NextResponse.json(
      { message: "아바타를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  if (resolved.kind === "unsupported") {
    return NextResponse.json(
      { message: "지원하지 않는 아바타 형식입니다." },
      { status: 415 },
    );
  }

  if (resolved.kind === "invalid") {
    return NextResponse.json(
      { message: "아바타 데이터 형식이 올바르지 않습니다." },
      { status: 500 },
    );
  }

  return new NextResponse(resolved.body, {
    status: 200,
    headers: {
      "content-type": resolved.contentType,
      "content-length": String(resolved.byteLength),
      "cache-control": cacheControl,
      ...(options.lastModified
        ? { "last-modified": new Date(options.lastModified).toUTCString() }
        : {}),
    },
  });
}
