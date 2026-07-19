import type {
  ImageTransformPolicy,
  ImageUploadPurpose,
} from "@/lib/image-upload/policy";

export const IMAGE_UPLOAD_STAGING_BUCKET = "image-upload-staging";
export const IMAGE_UPLOAD_SIGNED_URL_TTL_SECONDS = 10 * 60;
export const IMAGE_UPLOAD_SESSION_TTL_MS = 2 * 60 * 60 * 1000;
export const IMAGE_UPLOAD_APPROVAL_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function getImageUploadSignedUrlExpiresAt(now = new Date()) {
  return new Date(now.getTime() + IMAGE_UPLOAD_SIGNED_URL_TTL_SECONDS * 1000);
}

export function isImageUploadSignedUrlExpired(
  expiresAt: string | Date,
  now = new Date(),
) {
  const expiresAtMs = new Date(expiresAt).getTime();
  return !Number.isFinite(expiresAtMs) || expiresAtMs <= now.getTime();
}

export type ImageUploadOwnerKind =
  | "admin"
  | "member"
  | "partner"
  | "graduate_challenge"
  | "guest"
  | "signup";

export type ImageUploadActor = {
  kind: ImageUploadOwnerKind;
  id: string;
};

export type ImageUploadSignRequest = {
  clientId: string;
  role: string;
  fileName: string;
  contentType: string;
  size: number;
};

export type SignedImageUpload = {
  id: string;
  clientId: string;
  path: string;
  signedUrl: string;
  expiresAt: string;
};

export type CompletedImageUpload = {
  id: string;
  role: string;
  status: "ready" | "attached";
  width: number;
  height: number;
};

export type ImageUploadDestination = {
  bucket: string;
  path: string;
  isPublic: boolean;
  cacheControl?: string;
};

export type AttachedImageUpload = {
  id: string;
  bucket: string;
  path: string;
  url: string | null;
  sha256: string;
  width: number;
  height: number;
};

export type SignImageUploadInput = {
  actor: ImageUploadActor;
  purpose: ImageUploadPurpose;
  uploads: ImageUploadSignRequest[];
  now?: Date;
};

export type CompleteImageUploadInput = {
  actor: ImageUploadActor;
  purpose: ImageUploadPurpose;
  uploadIds: string[];
  now?: Date;
};

export type AttachImageUploadInput = {
  actor: ImageUploadActor;
  purpose: ImageUploadPurpose;
  uploadId: string;
  role: string;
  policy: ImageTransformPolicy;
  destination: ImageUploadDestination;
  resource?: {
    type: string;
    id: string;
  };
  now?: Date;
};

export type RetainImageUploadForApprovalInput = {
  actor: ImageUploadActor;
  purpose: ImageUploadPurpose;
  uploadId: string;
  role: string;
  expiresAt: Date;
  now?: Date;
};

export type DiscardImageUploadInput = {
  actor: ImageUploadActor;
  purpose: ImageUploadPurpose;
  uploadId: string;
  now?: Date;
};

export interface ImageUploadRepository {
  sign(input: SignImageUploadInput): Promise<SignedImageUpload[]>;
  complete(input: CompleteImageUploadInput): Promise<CompletedImageUpload[]>;
  attach(input: AttachImageUploadInput): Promise<AttachedImageUpload>;
  retainForApproval(input: RetainImageUploadForApprovalInput): Promise<void>;
  discard(input: DiscardImageUploadInput): Promise<void>;
  expireStale(now?: Date): Promise<number>;
}
