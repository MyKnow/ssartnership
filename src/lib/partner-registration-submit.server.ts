import { randomUUID } from "node:crypto";
import {
  type AdminPartnerFileCategory,
} from "@/lib/admin-partner-file-import";
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

function assertUploadOnlyEntry(kind: "existing" | "upload") {
  if (kind === "existing") {
    throw new Error("신규 등록 이미지는 파일 업로드만 사용할 수 있습니다.");
  }
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

export async function insertPartnerRegistrationRequest({
  requestId = randomUUID(),
  values,
  categories,
  context,
  media = { thumbnailUrl: null, imageUrls: [], uploadedUrls: [] },
}: {
  requestId?: string;
  values: PartnerRegistrationResolvedValues;
  categories: AdminPartnerFileCategory[];
  context: PartnerRegistrationInsertContext;
  media?: PartnerRegistrationMediaPayload;
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
      service_mode: values.serviceMode,
      benefit_action_type: values.benefitActionType,
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

  return {
    requestId: insertResult.data.id as string,
    categoryLabel: matchedCategory?.label ?? values.categoryLabel,
    categoryMatched: Boolean(matchedCategory),
  };
}
