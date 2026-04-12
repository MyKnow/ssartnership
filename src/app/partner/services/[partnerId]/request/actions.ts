"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  PartnerChangeRequestError,
} from "@/lib/partner-change-request-errors";
import {
  cancelPartnerChangeRequest,
  createPartnerChangeRequest,
} from "@/lib/partner-change-requests";
import { getPartnerSession } from "@/lib/partner-session";
import { parsePartnerAudienceSelection } from "@/lib/partner-audience";
import { parsePartnerMediaManifest } from "@/lib/partner-media";
import {
  deletePartnerMediaUrls,
  uploadPartnerMediaFile,
} from "@/lib/partner-media-storage";
import {
  sanitizeHttpUrl,
  sanitizePartnerLinkValue,
  validateDateRange,
} from "@/lib/validation";

type PartnerRequestMediaPayload = {
  thumbnail: string | null;
  images: string[];
  uploadedUrls: string[];
};

function parseList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/\n+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function getFormDataFile(formData: FormData, name: string) {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

function getReturnUrl(partnerId: string) {
  return `/partner/services/${encodeURIComponent(partnerId)}`;
}

async function resolvePartnerMediaPayload(
  formData: FormData,
  partnerId: string,
): Promise<PartnerRequestMediaPayload> {
  const uploadedUrls: string[] = [];

  try {
    const thumbnailManifestRaw = String(formData.get("thumbnailManifest") || "");
    const galleryManifestRaw = String(formData.get("galleryManifest") || "");
    const thumbnailManifest = parsePartnerMediaManifest(thumbnailManifestRaw);
    const galleryManifest = parsePartnerMediaManifest(galleryManifestRaw);

    if (thumbnailManifestRaw.trim() && !thumbnailManifest) {
      throw new PartnerChangeRequestError(
        "invalid_request",
        "썸네일 이미지 형식을 확인해 주세요.",
      );
    }
    if (galleryManifestRaw.trim() && !galleryManifest) {
      throw new PartnerChangeRequestError(
        "invalid_request",
        "이미지 목록 형식을 확인해 주세요.",
      );
    }

    const thumbnailFile = getFormDataFile(formData, "thumbnailFile");
    const galleryFiles = formData
      .getAll("galleryFiles")
      .filter((item): item is File => item instanceof File && item.size > 0);

    let thumbnail: string | null = null;
    if (thumbnailManifest?.thumbnail) {
      if (thumbnailManifest.thumbnail.kind === "existing") {
        thumbnail = thumbnailManifest.thumbnail.url;
      } else {
        if (!thumbnailFile) {
          throw new PartnerChangeRequestError(
            "invalid_request",
            "썸네일 이미지를 찾을 수 없습니다.",
          );
        }
        thumbnail = await uploadPartnerMediaFile(
          partnerId,
          "thumbnail",
          thumbnailFile,
          0,
        );
        uploadedUrls.push(thumbnail);
      }
    }

    const images: string[] = [];
    let galleryFileIndex = 0;
    for (const [index, entry] of (galleryManifest?.gallery ?? []).entries()) {
      if (entry.kind === "existing") {
        images.push(entry.url);
        continue;
      }

      const file = galleryFiles[galleryFileIndex++];
      if (!file) {
        throw new PartnerChangeRequestError(
          "invalid_request",
          "추가 이미지를 찾을 수 없습니다.",
        );
      }

      const uploadedUrl = await uploadPartnerMediaFile(
        partnerId,
        "gallery",
        file,
        index,
      );
      images.push(uploadedUrl);
      uploadedUrls.push(uploadedUrl);
    }

    return { thumbnail, images, uploadedUrls };
  } catch (error) {
    await deletePartnerMediaUrls(uploadedUrls).catch(() => undefined);
    throw error;
  }
}

export async function submitPartnerChangeRequest(formData: FormData) {
  const session = await getPartnerSession();
  if (!session) {
    redirect("/partner/login");
  }
  if (session.mustChangePassword) {
    redirect("/partner/change-password");
  }

  const partnerId = String(formData.get("partnerId") || "").trim();
  if (!partnerId) {
    redirect("/partner?error=invalid_request");
  }

  const partnerName = String(formData.get("partnerName") || "").trim();
  const partnerLocation = String(formData.get("partnerLocation") || "").trim();
  const rawMapUrl = String(formData.get("mapUrl") || "").trim();
  const conditions = parseList(String(formData.get("conditions") || ""));
  const benefits = parseList(String(formData.get("benefits") || ""));
  const tags = parseList(String(formData.get("tags") || ""));
  const appliesTo = parsePartnerAudienceSelection(
    formData.getAll("appliesTo").map((item) => String(item).trim()),
  );
  const rawReservationLink = String(formData.get("reservationLink") || "").trim();
  const rawInquiryLink = String(formData.get("inquiryLink") || "").trim();
  const periodStart = String(formData.get("periodStart") || "").trim();
  const periodEnd = String(formData.get("periodEnd") || "").trim();

  if (!appliesTo) {
    redirect(`${getReturnUrl(partnerId)}?mode=edit&error=invalid_request`);
  }

  let media: PartnerRequestMediaPayload | null = null;

  try {
    if (!partnerName || !partnerLocation) {
      throw new PartnerChangeRequestError(
        "invalid_request",
        "브랜드명과 위치를 입력해 주세요.",
      );
    }

    const dateRangeError = validateDateRange(periodStart, periodEnd);
    if (dateRangeError) {
      throw new PartnerChangeRequestError("invalid_request", dateRangeError);
    }

    const mapUrl = rawMapUrl ? sanitizeHttpUrl(rawMapUrl) : null;
    if (rawMapUrl && !mapUrl) {
      throw new PartnerChangeRequestError(
        "invalid_request",
        "지도 URL 형식을 확인해 주세요.",
      );
    }

    const reservationLink = rawReservationLink
      ? sanitizePartnerLinkValue(rawReservationLink)
      : null;
    if (rawReservationLink && !reservationLink) {
      throw new PartnerChangeRequestError(
        "invalid_request",
        "예약 링크 형식을 확인해 주세요.",
      );
    }

    const inquiryLink = rawInquiryLink
      ? sanitizePartnerLinkValue(rawInquiryLink)
      : null;
    if (rawInquiryLink && !inquiryLink) {
      throw new PartnerChangeRequestError(
        "invalid_request",
        "문의 링크 형식을 확인해 주세요.",
      );
    }

    media = await resolvePartnerMediaPayload(formData, partnerId);

    await createPartnerChangeRequest({
      companyIds: session.companyIds,
      partnerId,
      requestedByAccountId: session.accountId,
      requestedByLoginId: session.loginId,
      requestedByDisplayName: session.displayName,
      requestedPartnerName: partnerName,
      requestedPartnerLocation: partnerLocation,
      requestedMapUrl: mapUrl,
      requestedConditions: conditions,
      requestedBenefits: benefits,
      requestedTags: tags,
      requestedAppliesTo: appliesTo,
      requestedThumbnail: media.thumbnail,
      requestedImages: media.images,
      requestedReservationLink: reservationLink,
      requestedInquiryLink: inquiryLink,
      requestedPeriodStart: periodStart || null,
      requestedPeriodEnd: periodEnd || null,
    });
  } catch (error) {
    if (media) {
      await deletePartnerMediaUrls(media.uploadedUrls).catch(() => undefined);
    }
    if (error instanceof PartnerChangeRequestError) {
      redirect(`${getReturnUrl(partnerId)}?mode=edit&error=${error.code}`);
    }
    throw error;
  }

  revalidatePath("/partner");
  revalidatePath("/admin/partners");
  revalidatePath(`/partner/services/${encodeURIComponent(partnerId)}`);
  redirect(`${getReturnUrl(partnerId)}?mode=edit&success=submitted`);
}

export async function cancelPartnerChangeRequestAction(formData: FormData) {
  const session = await getPartnerSession();
  if (!session) {
    redirect("/partner/login");
  }
  if (session.mustChangePassword) {
    redirect("/partner/change-password");
  }

  const requestId = String(formData.get("requestId") || "").trim();
  const partnerId = String(formData.get("partnerId") || "").trim();
  if (!requestId || !partnerId) {
    redirect("/partner?error=invalid_request");
  }

  try {
    await cancelPartnerChangeRequest({
      requestId,
      accountId: session.accountId,
      companyIds: session.companyIds,
    });
  } catch (error) {
    if (error instanceof PartnerChangeRequestError) {
      redirect(`${getReturnUrl(partnerId)}?mode=edit&error=${error.code}`);
    }
    throw error;
  }

  revalidatePath("/partner");
  revalidatePath("/admin/partners");
  revalidatePath(`/partner/services/${encodeURIComponent(partnerId)}`);
  redirect(`${getReturnUrl(partnerId)}?mode=edit&success=cancelled`);
}
