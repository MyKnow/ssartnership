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
} from "@/lib/member-manual-import/shared";

export const runtime = "nodejs";

async function requireImportAdmin(request: NextRequest) {
  if (!isTrustedSameOriginRequest(request, { expectedOrigin: request.nextUrl.origin })) {
    return { response: NextResponse.json({ message: "요청을 확인해 주세요." }, { status: 403 }) };
  }
  const session = await getAdminSession();
  if (!session) return { response: NextResponse.json({ message: "관리자 인증이 필요합니다." }, { status: 401 }) };
  if (!canAdmin(session.account.permissions, "members", "create")) {
    return { response: NextResponse.json({ message: "회원 생성 권한이 필요합니다." }, { status: 403 }) };
  }
  return { adminId: session.adminId };
}

function parsePhotoManifest(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.every((item) =>
      item && typeof item === "object"
      && typeof (item as { filename?: unknown }).filename === "string"
      && typeof (item as { contentType?: unknown }).contentType === "string"
      && typeof (item as { size?: unknown }).size === "number",
    ) ? parsed as ManualMemberImportPhotoManifestEntry[] : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireImportAdmin(request);
  if ("response" in auth) return auth.response;
  try {
    const formData = await request.formData();
    const file = formData.get("xlsx");
    const photos = parsePhotoManifest(formData.get("photos"));
    if (!(file instanceof File) || !photos) {
      return NextResponse.json({ ok: false, errors: ["XLSX와 사진 목록을 확인해 주세요."] }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MANUAL_MEMBER_IMPORT_LIMITS.xlsxBytes) {
      return NextResponse.json({ ok: false, errors: ["XLSX 파일은 1MB 이하만 업로드할 수 있습니다."] }, { status: 400 });
    }
    const result = await prepareManualMemberImport({
      adminId: auth.adminId,
      xlsxBuffer: Buffer.from(await file.arrayBuffer()),
      photos,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch {
    return NextResponse.json({ ok: false, errors: ["가져오기 준비에 실패했습니다."] }, { status: 400 });
  }
}
