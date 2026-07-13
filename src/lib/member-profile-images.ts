import { randomUUID } from "node:crypto";
import { normalizeMattermostProfileImage } from "@/lib/graduate-verification-files";
import { storeMemberProfileImage } from "@/lib/graduate-verification-storage";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const ALLOWED_IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type ExistingProfileImage = {
  id: string;
  status: "pending" | "approved" | "rejected" | "superseded";
};

type ActiveProfileImageMemberRow = {
  active_profile_image_id: string | null;
  must_change_password: boolean;
  profile_photo_review_status: "approved" | "pending" | "rejected";
  updated_at: string | null;
};

type ActiveProfileImageRow = {
  id: string;
  storage_path: string;
};

export type MemberProfileImageSource = "legacy" | "mattermost";

export type ActiveMemberProfileImage = {
  imageId: string;
  storagePath: string;
  updatedAt: string | null;
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

export async function getActiveMemberProfileImage(
  memberId: string,
  options: { requirePasswordSetup?: boolean } = {},
): Promise<ActiveMemberProfileImage | null> {
  const supabase = getSupabaseAdminClient();
  const { data: memberData, error: memberError } = await supabase
    .from("members")
    .select(
      "active_profile_image_id,must_change_password,profile_photo_review_status,updated_at",
    )
    .eq("id", memberId)
    .is("deleted_at", null)
    .maybeSingle();
  if (memberError) {
    throw new Error("현재 프로필 사진을 불러오지 못했습니다.");
  }

  const member = (memberData as ActiveProfileImageMemberRow | null) ?? null;
  if (
    !member?.active_profile_image_id
    || member.profile_photo_review_status !== "approved"
    || (options.requirePasswordSetup && member.must_change_password)
  ) {
    return null;
  }

  const { data: imageData, error: imageError } = await supabase
    .from("member_profile_images")
    .select("id,storage_path")
    .eq("id", member.active_profile_image_id)
    .eq("status", "approved")
    .is("deleted_at", null)
    .maybeSingle();
  if (imageError) {
    throw new Error("현재 프로필 사진을 불러오지 못했습니다.");
  }

  const image = (imageData as ActiveProfileImageRow | null) ?? null;
  if (!image?.id || !image.storage_path) {
    return null;
  }

  return {
    imageId: image.id,
    storagePath: image.storage_path,
    updatedAt: member.updated_at,
  };
}

export async function createOrReuseMemberProfileImage(input: {
  memberId: string;
  activeProfileImageId: string | null;
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
    return {
      imageId: reusableImage.id,
      changed: reusableImage.id !== input.activeProfileImageId,
    };
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
      status: "approved",
      reviewed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (insertError || !image?.id) {
    throw new Error("프로필 사진 상태를 저장하지 못했습니다.");
  }

  return { imageId: image.id as string, changed: true };
}

export async function activateMemberProfileImage(input: {
  memberId: string;
  previousImageId: string | null;
  nextImageId: string;
  updatedAt?: string;
}) {
  if (input.previousImageId === input.nextImageId) {
    return false;
  }

  const supabase = getSupabaseAdminClient();
  const updatedAt = input.updatedAt ?? new Date().toISOString();
  const { error: memberError } = await supabase
    .from("members")
    .update({
      active_profile_image_id: input.nextImageId,
      profile_photo_review_status: "approved",
      updated_at: updatedAt,
    })
    .eq("id", input.memberId)
    .is("deleted_at", null);
  if (memberError) {
    throw new Error("현재 프로필 사진을 반영하지 못했습니다.");
  }

  if (input.previousImageId) {
    const { error: previousImageError } = await supabase
      .from("member_profile_images")
      .update({
        status: "superseded",
        delete_after: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        updated_at: updatedAt,
      })
      .eq("id", input.previousImageId)
      .eq("status", "approved");
    if (previousImageError) {
      throw new Error("이전 프로필 사진 상태를 정리하지 못했습니다.");
    }
  }

  return true;
}
