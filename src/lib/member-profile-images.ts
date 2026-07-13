import { randomUUID } from "node:crypto";
import { normalizeMattermostProfileImage } from "@/lib/graduate-verification-files";
import { storeMemberProfileImage } from "@/lib/graduate-verification-storage";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const ALLOWED_IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const REVIEWABLE_IMAGE_STATUSES = ["pending", "approved", "rejected"] as const;

type MemberProfileImageStatus =
  | (typeof REVIEWABLE_IMAGE_STATUSES)[number]
  | "superseded";

type ExistingProfileImage = {
  id: string;
  status: MemberProfileImageStatus;
};

type ActiveProfileImageMemberRow = {
  must_change_password: boolean;
};

type MemberProfileImageRow = {
  id: string;
  member_id: string | null;
  status: MemberProfileImageStatus;
  storage_path: string | null;
  updated_at: string | null;
  created_at: string | null;
};

export type MemberProfileImageSource = "legacy" | "mattermost";
export type MemberProfilePhotoReviewStatus =
  | "approved"
  | "pending"
  | "rejected";

export type MemberProfilePhotoStateImage = {
  id: string;
  status: MemberProfileImageStatus;
  storagePath: string | null;
  updatedAt: string | null;
  createdAt: string | null;
};

export type MemberProfilePhotoState = {
  reviewStatus: MemberProfilePhotoReviewStatus;
  activeProfileImageId: string | null;
  activeStoragePath: string | null;
  updatedAt: string | null;
};

export type ActiveMemberProfileImage = {
  imageId: string;
  storagePath: string;
  updatedAt: string | null;
};

const DEFAULT_MEMBER_PROFILE_PHOTO_STATE: MemberProfilePhotoState = {
  reviewStatus: "approved",
  activeProfileImageId: null,
  activeStoragePath: null,
  updatedAt: null,
};

function normalizeContentType(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return ALLOWED_IMAGE_CONTENT_TYPES.has(normalized) ? normalized : null;
}

function isValidBase64(value: string) {
  const normalized = value.replace(/\s/g, "");
  if (
    !normalized
    || normalized.length % 4 === 1
    || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)
  ) {
    return false;
  }
  const decoded = Buffer.from(normalized, "base64");
  return decoded.length > 0
    && decoded.toString("base64").replace(/=+$/u, "")
      === normalized.replace(/=+$/u, "");
}

function getImageTimestamp(image: MemberProfilePhotoStateImage) {
  return image.updatedAt ?? image.createdAt;
}

function compareNewestProfileImage(
  left: MemberProfilePhotoStateImage,
  right: MemberProfilePhotoStateImage,
) {
  const leftTimestamp = getImageTimestamp(left) ?? "";
  const rightTimestamp = getImageTimestamp(right) ?? "";
  if (leftTimestamp !== rightTimestamp) {
    return rightTimestamp.localeCompare(leftTimestamp);
  }
  return right.id.localeCompare(left.id);
}

function isReviewableImageStatus(
  status: MemberProfileImageStatus,
): status is MemberProfilePhotoReviewStatus {
  return REVIEWABLE_IMAGE_STATUSES.includes(
    status as MemberProfilePhotoReviewStatus,
  );
}

function toMemberProfilePhotoStateImage(
  image: MemberProfileImageRow,
): MemberProfilePhotoStateImage {
  return {
    id: image.id,
    status: image.status,
    storagePath: image.storage_path,
    updatedAt: image.updated_at,
    createdAt: image.created_at,
  };
}

export function decodeMemberProfileImageData(
  value: string | null | undefined,
  fallbackContentType: string | null | undefined,
) {
  if (!value) {
    return null;
  }

  const dataUriMatch = value.match(/^data:([^;,]+);base64,([\s\S]+)$/iu);
  const contentType = normalizeContentType(
    dataUriMatch?.[1] ?? fallbackContentType ?? null,
  );
  const encoded = dataUriMatch?.[2] ?? value;
  if (!contentType || !isValidBase64(encoded)) {
    return null;
  }

  return {
    contentType,
    source: Buffer.from(encoded.replace(/\s/g, ""), "base64"),
  };
}

/**
 * The newest reviewable ledger record controls whether a member can use a
 * profile image. An older approved image is deliberately hidden while a newer
 * replacement is pending or rejected.
 */
export function resolveMemberProfilePhotoState(
  images: readonly MemberProfilePhotoStateImage[],
): MemberProfilePhotoState {
  const reviewableImages = images
    .filter(
      (
        image,
      ): image is MemberProfilePhotoStateImage & {
        status: MemberProfilePhotoReviewStatus;
      } => isReviewableImageStatus(image.status),
    )
    .toSorted(compareNewestProfileImage);
  const newestReview = reviewableImages[0];
  if (!newestReview) {
    return { ...DEFAULT_MEMBER_PROFILE_PHOTO_STATE };
  }

  if (newestReview.status !== "approved") {
    return {
      reviewStatus: newestReview.status,
      activeProfileImageId: null,
      activeStoragePath: null,
      updatedAt: getImageTimestamp(newestReview),
    };
  }

  return {
    reviewStatus: "approved",
    activeProfileImageId: newestReview.id,
    activeStoragePath: newestReview.storagePath,
    updatedAt: getImageTimestamp(newestReview),
  };
}

export async function getMemberProfilePhotoStates(memberIds: readonly string[]) {
  const uniqueMemberIds = [...new Set(memberIds.filter(Boolean))];
  const states = new Map<string, MemberProfilePhotoState>();
  for (const memberId of uniqueMemberIds) {
    states.set(memberId, { ...DEFAULT_MEMBER_PROFILE_PHOTO_STATE });
  }
  if (uniqueMemberIds.length === 0) {
    return states;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("member_profile_images")
    .select("id,member_id,status,storage_path,updated_at,created_at")
    .in("member_id", uniqueMemberIds)
    .in("status", [...REVIEWABLE_IMAGE_STATUSES])
    .is("deleted_at", null);
  if (error) {
    throw new Error("프로필 사진 상태를 불러오지 못했습니다.");
  }

  const imagesByMemberId = new Map<string, MemberProfilePhotoStateImage[]>();
  for (const row of (data ?? []) as MemberProfileImageRow[]) {
    if (!row.member_id) {
      continue;
    }
    const images = imagesByMemberId.get(row.member_id) ?? [];
    images.push(toMemberProfilePhotoStateImage(row));
    imagesByMemberId.set(row.member_id, images);
  }
  for (const memberId of uniqueMemberIds) {
    states.set(
      memberId,
      resolveMemberProfilePhotoState(imagesByMemberId.get(memberId) ?? []),
    );
  }
  return states;
}

export async function getMemberProfilePhotoState(memberId: string) {
  const states = await getMemberProfilePhotoStates([memberId]);
  return states.get(memberId) ?? { ...DEFAULT_MEMBER_PROFILE_PHOTO_STATE };
}

export async function getActiveMemberProfileImage(
  memberId: string,
  options: { requirePasswordSetup?: boolean } = {},
): Promise<ActiveMemberProfileImage | null> {
  const supabase = getSupabaseAdminClient();
  const [memberResult, photoState] = await Promise.all([
    supabase
      .from("members")
      .select("must_change_password")
      .eq("id", memberId)
      .is("deleted_at", null)
      .maybeSingle(),
    getMemberProfilePhotoState(memberId),
  ]);
  if (memberResult.error) {
    throw new Error("현재 프로필 사진을 불러오지 못했습니다.");
  }

  const member =
    (memberResult.data as ActiveProfileImageMemberRow | null) ?? null;
  if (
    !member
    || photoState.reviewStatus !== "approved"
    || !photoState.activeProfileImageId
    || !photoState.activeStoragePath
    || (options.requirePasswordSetup && member.must_change_password)
  ) {
    return null;
  }

  return {
    imageId: photoState.activeProfileImageId,
    storagePath: photoState.activeStoragePath,
    updatedAt: photoState.updatedAt,
  };
}

export async function createOrReuseMemberProfileImage(input: {
  memberId: string;
  contentType: string;
  source: Buffer;
  imageSource: MemberProfileImageSource;
}) {
  const normalized = await normalizeMattermostProfileImage({
    contentType: input.contentType,
    source: input.source,
  });
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("member_profile_images")
    .select("id,status")
    .eq("member_id", input.memberId)
    .eq("sha256", normalized.sha256)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error("프로필 사진 상태를 불러오지 못했습니다.");
  }

  const existingImages = (data ?? []) as ExistingProfileImage[];
  const reusableImage = existingImages.find(
    (image) => image.status === "approved",
  );
  if (reusableImage?.id) {
    return { imageId: reusableImage.id, changed: false };
  }

  const storagePath = await storeMemberProfileImage({
    memberId: input.memberId,
    sha256: normalized.sha256,
    buffer: normalized.buffer,
    variant: existingImages.length > 0 ? randomUUID() : undefined,
  });
  const { data: image, error: insertError } = await supabase
    .from("member_profile_images")
    .insert({
      member_id: input.memberId,
      storage_path: storagePath,
      sha256: normalized.sha256,
      content_type: normalized.contentType,
      width: normalized.width,
      height: normalized.height,
      source: input.imageSource,
      // This is promoted immediately after the independent profile fields are
      // updated. A failed promotion is explicitly discarded by the caller.
      status: "pending",
    })
    .select("id")
    .single();
  if (insertError || !image?.id) {
    throw new Error("프로필 사진 상태를 저장하지 못했습니다.");
  }

  return { imageId: image.id as string, changed: true };
}

export async function discardMemberProfileImage(input: {
  memberId: string;
  imageId: string;
  updatedAt?: string;
}) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("member_profile_images")
    .update({
      status: "superseded",
      delete_after: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      updated_at: input.updatedAt ?? new Date().toISOString(),
    })
    .eq("id", input.imageId)
    .eq("member_id", input.memberId)
    .eq("status", "pending")
    .is("deleted_at", null);
  if (error) {
    throw new Error("실패한 프로필 사진 동기화를 정리하지 못했습니다.");
  }
}

export async function activateMemberProfileImage(input: {
  memberId: string;
  nextImageId: string;
  updatedAt?: string;
}) {
  const supabase = getSupabaseAdminClient();
  const updatedAt = input.updatedAt ?? new Date().toISOString();
  const [{ data: member, error: memberLookupError }, { data: target, error: targetLookupError }] =
    await Promise.all([
      supabase
        .from("members")
        .select("id")
        .eq("id", input.memberId)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("member_profile_images")
        .select("id")
        .eq("id", input.nextImageId)
        .eq("member_id", input.memberId)
        .is("deleted_at", null)
        .maybeSingle(),
    ]);
  if (memberLookupError || !member?.id || targetLookupError || !target?.id) {
    throw new Error("현재 프로필 사진을 반영하지 못했습니다.");
  }

  const { error: previousImagesError } = await supabase
    .from("member_profile_images")
    .update({
      status: "superseded",
      delete_after: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      updated_at: updatedAt,
    })
    .eq("member_id", input.memberId)
    .neq("id", input.nextImageId)
    .eq("status", "approved")
    .is("deleted_at", null);
  if (previousImagesError) {
    throw new Error("이전 프로필 사진 상태를 정리하지 못했습니다.");
  }

  const { data: activatedImage, error: activationError } = await supabase
    .from("member_profile_images")
    .update({
      status: "approved",
      reviewed_at: updatedAt,
      review_note: null,
      delete_after: null,
      updated_at: updatedAt,
    })
    .eq("id", input.nextImageId)
    .eq("member_id", input.memberId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (activationError || !activatedImage?.id) {
    throw new Error("현재 프로필 사진을 반영하지 못했습니다.");
  }

  const { error: memberUpdateError } = await supabase
    .from("members")
    .update({ updated_at: updatedAt })
    .eq("id", input.memberId)
    .is("deleted_at", null);
  if (memberUpdateError) {
    throw new Error("현재 프로필 사진 변경 시각을 저장하지 못했습니다.");
  }

  return true;
}
