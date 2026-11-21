import { MEMBER_PROFILE_IMAGES_BUCKET } from "@/lib/graduate-verification-storage";
import { resolveImageTransformPolicy, PROFILE_IMAGE_EDGE_PX } from "@/lib/image-upload/policy";
import type { ImageUploadActor } from "@/lib/image-upload/repository";
import { getImageUploadRepository } from "@/lib/image-upload/repository.server";

export type CommonProfileImageUpload = {
  storagePath: string;
  sha256: string;
  width: number;
  height: number;
};

export async function attachCommonProfileImageUpload(input: {
  actor: ImageUploadActor;
  purpose: "profile" | "graduate-verification" | "manual-member-import";
  uploadId: string;
  destinationPath: string;
  resource: { type: string; id: string };
}): Promise<CommonProfileImageUpload> {
  const attached = await getImageUploadRepository().attach({
    actor: input.actor,
    purpose: input.purpose,
    uploadId: input.uploadId,
    role: "profile",
    policy: resolveImageTransformPolicy(input.purpose, "profile"),
    destination: {
      bucket: MEMBER_PROFILE_IMAGES_BUCKET,
      path: input.destinationPath,
      isPublic: false,
      cacheControl: "private, no-store",
    },
    resource: input.resource,
  });
  if (attached.width !== PROFILE_IMAGE_EDGE_PX || attached.height !== PROFILE_IMAGE_EDGE_PX) {
    throw new Error("프로필 사진 크기를 확인하지 못했습니다.");
  }
  return {
    storagePath: attached.path,
    sha256: attached.sha256,
    width: attached.width,
    height: attached.height,
  };
}
