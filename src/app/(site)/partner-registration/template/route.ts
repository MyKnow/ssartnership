import { NextResponse } from "next/server";
import {
  isAdminPartnerFileTemplateOptions,
  type AdminPartnerFileTemplateOptions,
} from "@/lib/admin-partner-file-import";
import { createAdminPartnerXlsxTemplate } from "@/lib/admin-partner-file-import.server";
import { partnerRepository } from "@/lib/repositories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseTemplateOptions(request: Request): AdminPartnerFileTemplateOptions | null {
  const url = new URL(request.url);
  const options = {
    serviceMode: url.searchParams.get("serviceMode") ?? "",
    benefitActionType: url.searchParams.get("benefitActionType") ?? "",
  } as AdminPartnerFileTemplateOptions;

  return isAdminPartnerFileTemplateOptions(options) ? options : null;
}

function buildFileName(options: AdminPartnerFileTemplateOptions) {
  const action = options.benefitActionType.replaceAll("_", "-");
  return `ssartnership-partner-registration-${options.serviceMode}-${action}.xlsx`;
}

export async function GET(request: Request) {
  const options = parseTemplateOptions(request);
  if (!options) {
    return NextResponse.json(
      { message: "템플릿 기준이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  let categories;
  try {
    categories = await partnerRepository.getCategoryOptions();
  } catch {
    return NextResponse.json(
      { message: "카테고리 목록을 불러오지 못했습니다." },
      { status: 500 },
    );
  }

  const buffer = await createAdminPartnerXlsxTemplate(options, categories);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${buildFileName(options)}"`,
      "Cache-Control": "no-store",
    },
  });
}
