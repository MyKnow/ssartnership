import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import {
  type AdminPartnerFileCategory,
  ADMIN_PARTNER_FILE_MAX_BYTES,
} from "@/lib/admin-partner-file-import";
import {
  getDefaultBranchTypeForScope,
  normalizePartnerBranchRows,
  type PartnerBranchDraft,
  type PartnerBranchInputRow,
} from "@/lib/partner-branch-registration";
import {
  PARTNER_REGISTRATION_GALLERY_MAX_FILES,
  resolvePartnerRegistrationCategory,
  validatePartnerRegistrationImageFile,
  type PartnerRegistrationResolvedValues,
  type PartnerRegistrationSource,
} from "@/lib/partner-registration";
import { parsePartnerMediaManifest } from "@/lib/partner-media";
import {
  deletePartnerMediaUrls,
  uploadPartnerRegistrationMediaFile,
} from "@/lib/partner-media-storage";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type PartnerRegistrationMediaPayload = {
  thumbnailUrl: string | null;
  imageUrls: string[];
  uploadedUrls: string[];
};

export type PartnerRegistrationInsertContext = {
  source: PartnerRegistrationSource;
  companyId?: string | null;
  requestedByPartnerAccountId?: string | null;
};

function getFormDataFile(formData: FormData, name: string) {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

function getFormDataFiles(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .filter((item): item is File => item instanceof File && item.size > 0);
}

function getOptionalFormDataFile(formData: FormData, name: string) {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

function assertUploadOnlyEntry(kind: "existing" | "upload") {
  if (kind === "existing") {
    throw new Error("신규 등록 이미지는 파일 업로드만 사용할 수 있습니다.");
  }
}

function buildRegistrationBenefitGroupRows(
  requestId: string,
  values: PartnerRegistrationResolvedValues,
  branches: PartnerBranchDraft[],
) {
  const groupLabels = new Map<string, string>();
  groupLabels.set("default", "기본 혜택");

  for (const branch of branches) {
    if (groupLabels.has(branch.benefitGroupKey)) {
      continue;
    }
    groupLabels.set(
      branch.benefitGroupKey,
      branch.benefitGroupLabel ?? branch.benefitGroupKey,
    );
  }

  return Array.from(groupLabels.entries()).map(([groupKey, label]) => ({
    registration_request_id: requestId,
    group_key: groupKey,
    label,
    benefit_action_type: values.benefitActionType,
    benefit_action_link: values.safeBenefitActionLink,
    benefits: values.parsedBenefits,
    conditions: values.parsedConditions,
    period_start: values.periodStart || null,
    period_end: values.periodEnd || null,
    tags: values.parsedTags,
  }));
}

export async function loadPartnerRegistrationCategories() {
  const result = await getSupabaseAdminClient()
    .from("categories")
    .select("id,key,label")
    .order("created_at", { ascending: true });

  if (result.error) {
    throw new Error(result.error.message);
  }
  return (result.data ?? []) as AdminPartnerFileCategory[];
}

export async function resolvePartnerRegistrationMediaPayload(
  formData: FormData,
  requestId: string,
): Promise<PartnerRegistrationMediaPayload> {
  const thumbnailManifestRaw = String(formData.get("thumbnailManifest") || "");
  const galleryManifestRaw = String(formData.get("galleryManifest") || "");
  const thumbnailManifest = parsePartnerMediaManifest(thumbnailManifestRaw);
  const galleryManifest = parsePartnerMediaManifest(galleryManifestRaw);

  if (thumbnailManifestRaw.trim() && !thumbnailManifest) {
    throw new Error("대표 이미지 형식을 확인해 주세요.");
  }
  if (galleryManifestRaw.trim() && !galleryManifest) {
    throw new Error("추가 이미지 목록 형식을 확인해 주세요.");
  }

  const thumbnailFile = getFormDataFile(formData, "thumbnailFile");
  const galleryFiles = getFormDataFiles(formData, "galleryFiles");
  const galleryEntries = galleryManifest?.gallery ?? [];
  if (galleryEntries.length > PARTNER_REGISTRATION_GALLERY_MAX_FILES) {
    throw new Error("추가 이미지는 최대 5장까지 업로드할 수 있습니다.");
  }
  if (galleryFiles.length > PARTNER_REGISTRATION_GALLERY_MAX_FILES) {
    throw new Error("추가 이미지는 최대 5장까지 업로드할 수 있습니다.");
  }

  const uploadedUrls: string[] = [];

  try {
    let thumbnailUrl: string | null = null;
    if (thumbnailManifest?.thumbnail) {
      assertUploadOnlyEntry(thumbnailManifest.thumbnail.kind);
      if (!thumbnailFile) {
        throw new Error("대표 이미지 파일을 찾을 수 없습니다.");
      }
      const thumbnailError = validatePartnerRegistrationImageFile(thumbnailFile);
      if (thumbnailError) {
        throw new Error(thumbnailError);
      }
      thumbnailUrl = await uploadPartnerRegistrationMediaFile(
        requestId,
        "thumbnail",
        thumbnailFile,
        0,
      );
      uploadedUrls.push(thumbnailUrl);
    }

    const imageUrls: string[] = [];
    let galleryFileIndex = 0;
    for (const [index, entry] of galleryEntries.entries()) {
      assertUploadOnlyEntry(entry.kind);
      const nextFile = galleryFiles[galleryFileIndex++];
      if (!nextFile) {
        throw new Error("추가 이미지 파일을 찾을 수 없습니다.");
      }
      const fileError = validatePartnerRegistrationImageFile(nextFile);
      if (fileError) {
        throw new Error(fileError);
      }
      const uploadedUrl = await uploadPartnerRegistrationMediaFile(
        requestId,
        "gallery",
        nextFile,
        index,
      );
      imageUrls.push(uploadedUrl);
      uploadedUrls.push(uploadedUrl);
    }

    return { thumbnailUrl, imageUrls, uploadedUrls };
  } catch (error) {
    await deletePartnerMediaUrls(uploadedUrls).catch(() => undefined);
    throw error;
  }
}

function getCellText(cell: ExcelJS.Cell) {
  const value = cell.value;
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") {
      return value.text.trim();
    }
    if ("result" in value) {
      return String(value.result ?? "").trim();
    }
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((item) => item.text).join("").trim();
    }
  }
  return String(value).trim();
}

function normalizeHeader(value: string) {
  return value.trim().replace(/\s+/g, "");
}

async function parsePartnerRegistrationBranchXlsxFile(
  file: File,
  values: PartnerRegistrationResolvedValues,
) {
  if (file.size > ADMIN_PARTNER_FILE_MAX_BYTES) {
    throw new Error("지점 XLSX 파일은 1MB 이하만 업로드할 수 있습니다.");
  }
  if (!/\.xlsx$/i.test(file.name)) {
    throw new Error("지점 목록은 .xlsx 파일만 업로드할 수 있습니다.");
  }

  const workbook = new ExcelJS.Workbook();
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  await workbook.xlsx.load(
    fileBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("지점 목록 시트를 찾지 못했습니다.");
  }

  const headerByColumn = new Map<number, string>();
  worksheet.getRow(1).eachCell((cell, columnNumber) => {
    const header = normalizeHeader(getCellText(cell));
    if (header) {
      headerByColumn.set(columnNumber, header);
    }
  });

  const rows: PartnerBranchInputRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }
    const rowValues = new Map<string, string>();
    row.eachCell((cell, columnNumber) => {
      const header = headerByColumn.get(columnNumber);
      if (!header) {
        return;
      }
      rowValues.set(header, getCellText(cell));
    });
    const hasAnyValue = Array.from(rowValues.values()).some(Boolean);
    if (!hasAnyValue) {
      return;
    }
    rows.push({
      benefitGroupLabel: rowValues.get("혜택그룹"),
      branchName: rowValues.get("지점명"),
      address: rowValues.get("주소"),
      branchCode: rowValues.get("지점코드"),
      branchType: rowValues.get("직영/가맹") ?? rowValues.get("지점유형"),
      mapUrl: rowValues.get("지도URL"),
      phone: rowValues.get("전화번호"),
      memo: rowValues.get("메모") ?? rowValues.get("운영메모"),
    });
  });

  const parsed = normalizePartnerBranchRows(rows, {
    companyName: values.companyName,
    brandName: values.brandName,
    defaultBenefitGroupKey: "default",
    defaultBranchType: getDefaultBranchTypeForScope(values.branchScopeType),
  });
  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors.join(" "));
  }
  return parsed.branches;
}

function mergePartnerRegistrationBranches(
  textBranches: PartnerBranchDraft[],
  fileBranches: PartnerBranchDraft[],
) {
  const branchesByKey = new Map<string, PartnerBranchDraft>();
  for (const branch of [...textBranches, ...fileBranches]) {
    branchesByKey.set(`${branch.benefitGroupKey}:${branch.branchKey}`, branch);
  }
  return Array.from(branchesByKey.values());
}

export async function resolvePartnerRegistrationBranchPayload(
  formData: FormData,
  values: PartnerRegistrationResolvedValues,
) {
  const file = getOptionalFormDataFile(formData, "branchListFile");
  const fileBranches = file
    ? await parsePartnerRegistrationBranchXlsxFile(file, values)
    : [];
  return mergePartnerRegistrationBranches(values.parsedBranches, fileBranches);
}

export async function insertPartnerRegistrationRequest({
  requestId = randomUUID(),
  values,
  categories,
  context,
  media = { thumbnailUrl: null, imageUrls: [], uploadedUrls: [] },
  branches = values.parsedBranches,
}: {
  requestId?: string;
  values: PartnerRegistrationResolvedValues;
  categories: AdminPartnerFileCategory[];
  context: PartnerRegistrationInsertContext;
  media?: PartnerRegistrationMediaPayload;
  branches?: PartnerBranchDraft[];
}) {
  const matchedCategory = resolvePartnerRegistrationCategory(
    values.categoryLabel,
    categories,
  );

  const insertResult = await getSupabaseAdminClient()
    .from("partner_registration_requests")
    .insert({
      id: requestId,
      source: context.source,
      company_id: context.companyId ?? null,
      requested_by_partner_account_id: context.requestedByPartnerAccountId ?? null,
      registration_mode: values.registrationMode,
      service_mode: values.serviceMode,
      benefit_action_type: values.benefitActionType,
      branch_scope_type: values.branchScopeType,
      branch_scope_note: values.branchScopeNote || null,
      brand_name: values.brandName,
      category_id: matchedCategory?.id ?? null,
      category_label: matchedCategory?.label ?? values.categoryLabel,
      period_start: values.periodStart || null,
      period_end: values.periodEnd || null,
      inquiry_link: values.safeInquiryLink,
      brand_phone: values.safeBrandPhone,
      detail_description: values.detailDescription || null,
      company_name: values.companyName,
      contact_name: values.contactName,
      contact_email: values.contactEmail,
      contact_phone: values.contactPhone || null,
      company_description: values.companyDescription || null,
      benefits: values.parsedBenefits,
      conditions: values.parsedConditions,
      tags: values.parsedTags,
      location: values.location,
      map_url: values.safeMapUrl,
      site_link: values.safeSiteLink,
      benefit_action_link: values.safeBenefitActionLink,
      thumbnail_url: media.thumbnailUrl,
      image_urls: media.imageUrls,
      memo: values.memo || null,
    })
    .select("id")
    .single();

  if (insertResult.error) {
    await deletePartnerMediaUrls(media.uploadedUrls).catch(() => undefined);
    console.error(
      "[partner-registration] request insert failed",
      insertResult.error.message,
    );
    throw new Error("신청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }

  const benefitGroupResult = await getSupabaseAdminClient()
    .from("partner_registration_benefit_groups")
    .insert(
      buildRegistrationBenefitGroupRows(insertResult.data.id, values, branches),
    );

  if (benefitGroupResult.error) {
    await deletePartnerMediaUrls(media.uploadedUrls).catch(() => undefined);
    await getSupabaseAdminClient()
      .from("partner_registration_requests")
      .delete()
      .eq("id", insertResult.data.id);
    console.error(
      "[partner-registration] benefit group insert failed",
      benefitGroupResult.error.message,
    );
    throw new Error("신청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }

  if (branches.length > 0) {
    const branchResult = await getSupabaseAdminClient()
      .from("partner_registration_branches")
      .insert(
        branches.map((branch) => ({
          registration_request_id: insertResult.data.id,
          benefit_group_key: branch.benefitGroupKey,
          branch_key: branch.branchKey,
          branch_code: branch.branchCode,
          name: branch.branchName,
          address: branch.address,
          branch_type: branch.branchType,
          campus_slugs: branch.campusSlugs,
          map_url: branch.mapUrl,
          phone: branch.phone,
          memo: branch.memo,
        })),
      );

    if (branchResult.error) {
      await deletePartnerMediaUrls(media.uploadedUrls).catch(() => undefined);
      await getSupabaseAdminClient()
        .from("partner_registration_requests")
        .delete()
        .eq("id", insertResult.data.id);
      console.error(
        "[partner-registration] branch insert failed",
        branchResult.error.message,
      );
      throw new Error("지점 목록을 저장하지 못했습니다. 입력값을 확인해 주세요.");
    }
  }

  return {
    requestId: insertResult.data.id as string,
    categoryLabel: matchedCategory?.label ?? values.categoryLabel,
    categoryMatched: Boolean(matchedCategory),
  };
}
