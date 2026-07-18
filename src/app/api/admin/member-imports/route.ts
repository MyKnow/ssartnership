import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { canAdmin } from "@/lib/admin-permissions";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import {
  prepareManualMemberImport,
} from "@/lib/member-manual-import/service.server";
import {
  MANUAL_MEMBER_IMPORT_LIMITS,
  type ManualMemberImportPhotoManifestEntry,
  type ManualMemberImportRawRow,
} from "@/lib/member-manual-import/shared";

export const runtime = "nodejs";

async function requireImportAdmin(request: NextRequest) {
  if (!isTrustedSameOriginRequest(request, {
    expectedOrigin: request.nextUrl.origin,
    allowedContentTypes: ["application/json"],
  })) {
    return { response: NextResponse.json({ message: "요청을 확인해 주세요." }, { status: 403 }) };
  }
  const session = await getAdminSession();
  if (!session) return { response: NextResponse.json({ message: "관리자 인증이 필요합니다." }, { status: 401 }) };
  if (!canAdmin(session.account.permissions, "members", "create")) {
    return { response: NextResponse.json({ message: "회원 생성 권한이 필요합니다." }, { status: 403 }) };
  }
  return { adminId: session.adminId };
}

function parsePhotoManifest(value: unknown) {
  if (!Array.isArray(value) || value.length > MANUAL_MEMBER_IMPORT_LIMITS.maxRows) {
    return null;
  }
  return value.every((item) =>
    item && typeof item === "object"
    && typeof (item as { filename?: unknown }).filename === "string"
    && typeof (item as { contentType?: unknown }).contentType === "string"
    && typeof (item as { size?: unknown }).size === "number"
    && typeof (item as { uploadId?: unknown }).uploadId === "string",
  ) ? value as ManualMemberImportPhotoManifestEntry[] : null;
}

function parseRows(value: unknown) {
  if (!Array.isArray(value) || value.length > MANUAL_MEMBER_IMPORT_LIMITS.maxRows) {
    return null;
  }
  const rows = value.map((item) => {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const rowNumber = row.rowNumber;
    if (typeof rowNumber !== "number" || !Number.isSafeInteger(rowNumber)) return null;
    return {
      rowNumber,
      generation: row.generation,
      name: row.name,
      campus: row.campus,
      mmId: row.mmId,
      email: row.email,
      photoFilename: row.photoFilename,
    } satisfies ManualMemberImportRawRow;
  });
  return rows.every((row): row is ManualMemberImportRawRow => row !== null)
    ? rows
    : null;
}

export async function POST(request: NextRequest) {
  const auth = await requireImportAdmin(request);
  if ("response" in auth) return auth.response;
  try {
    const contentType = request.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? await request.json().catch(() => null)
      : null;
    const rows = parseRows(payload && typeof payload === "object" ? payload.rows : null);
    const photos = parsePhotoManifest(payload && typeof payload === "object" ? payload.photos : null);
    if (!rows || !photos) {
      return NextResponse.json({ ok: false, errors: ["회원 행과 사진 목록을 확인해 주세요."] }, { status: 400 });
    }
    const result = await prepareManualMemberImport({
      adminId: auth.adminId,
      rows,
      photos,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch {
    return NextResponse.json({ ok: false, errors: ["가져오기 준비에 실패했습니다."] }, { status: 400 });
  }
}
