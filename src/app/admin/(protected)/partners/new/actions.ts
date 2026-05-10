"use server";

import {
  ADMIN_PARTNER_FILE_MAX_BYTES,
  type AdminPartnerFileParseResult,
} from "@/lib/admin-partner-file-import";
import { parseAdminPartnerXlsxDraft } from "@/lib/admin-partner-file-import.server";
import { requireAdmin } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type PartnerCompanyRow = {
  id: string;
  name: string;
};

function normalizePartnerCompanies(value: unknown): PartnerCompanyRow[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value as PartnerCompanyRow[];
  }
  if (typeof value === "object") {
    return [value as PartnerCompanyRow];
  }
  return [];
}

export async function parseAdminPartnerXlsxFileAction(
  formData: FormData,
): Promise<AdminPartnerFileParseResult> {
  await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, errors: ["XLSX 파일을 선택해 주세요."] };
  }
  if (file.size > ADMIN_PARTNER_FILE_MAX_BYTES) {
    return { ok: false, errors: ["XLSX 파일은 1MB 이하만 업로드할 수 있습니다."] };
  }

  const supabase = getSupabaseAdminClient();
  const [categoriesResult, companiesResult] = await Promise.all([
    supabase
      .from("categories")
      .select("id,key,label")
      .order("created_at", { ascending: true }),
    supabase
      .from("partner_companies")
      .select("id,name")
      .order("name", { ascending: true }),
  ]);

  if (categoriesResult.error || companiesResult.error) {
    return {
      ok: false,
      errors: ["템플릿 검증에 필요한 기준 데이터를 불러오지 못했습니다."],
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return parseAdminPartnerXlsxDraft({
    fileBuffer: buffer,
    categories: categoriesResult.data ?? [],
    companies: normalizePartnerCompanies(companiesResult.data),
  });
}
