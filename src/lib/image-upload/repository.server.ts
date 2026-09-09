import {
  ImageUploadError,
  type ImageUploadRepository,
} from "@/lib/image-upload/repository";
import {
  getSupabaseSignedImageUploadHeaders,
  SupabaseImageUploadRepository,
} from "@/lib/image-upload/repository.supabase";
import {
  selectRuntimeDataAccess,
  type RuntimeDataAccessEnvironment,
  type RuntimeDataAccessSelection,
} from "@/lib/runtime-data-access";

export type ImageUploadRepositoryEnvironment = RuntimeDataAccessEnvironment;

export class ImageUploadRepositoryUnavailableError extends ImageUploadError {
  constructor(options?: ErrorOptions) {
    super(
      "image_upload_unavailable",
      "현재 환경에서는 이미지 업로드를 사용할 수 없습니다.",
      options,
    );
    this.name = "ImageUploadRepositoryUnavailableError";
  }
}

const rejectUnavailableImageUpload = (): Promise<never> =>
  Promise.reject(new ImageUploadRepositoryUnavailableError());

class UnavailableImageUploadRepository implements ImageUploadRepository {
  readonly sign = rejectUnavailableImageUpload;
  readonly complete = rejectUnavailableImageUpload;
  readonly attach = rejectUnavailableImageUpload;
  readonly retainForApproval = rejectUnavailableImageUpload;
  readonly discard = rejectUnavailableImageUpload;
  readonly expireStale = rejectUnavailableImageUpload;
}

export function selectImageUploadDataAccess(
  environment: ImageUploadRepositoryEnvironment = process.env,
): RuntimeDataAccessSelection {
  const selection = selectRuntimeDataAccess({
    capability: "admin",
    environment,
  });
  if (selection.source === "mock") {
    return {
      capability: selection.capability,
      source: "unavailable",
      reason: "unsupported_capability",
    };
  }
  if (
    selection.source === "supabase" &&
    !environment.SUPABASE_ANON_KEY?.trim()
  ) {
    return {
      capability: "admin",
      source: "unavailable",
      reason: "missing_credentials",
    };
  }
  return selection;
}

export function createImageUploadRepository(
  environment: ImageUploadRepositoryEnvironment,
  createSupabaseRepository: () => ImageUploadRepository = () =>
    new SupabaseImageUploadRepository(),
): ImageUploadRepository {
  const selection = selectImageUploadDataAccess(environment);
  if (selection.source !== "supabase") {
    return new UnavailableImageUploadRepository();
  }
  return createSupabaseRepository();
}

const imageUploadDataAccess = selectImageUploadDataAccess();
let repository: ImageUploadRepository | null = null;

export function getImageUploadRepository() {
  repository ??= imageUploadDataAccess.source === "supabase"
    ? new SupabaseImageUploadRepository()
    : new UnavailableImageUploadRepository();
  return repository;
}

export function getSignedImageUploadHeaders(
  environment: ImageUploadRepositoryEnvironment = process.env,
) {
  const selection = selectImageUploadDataAccess(environment);
  if (selection.source !== "supabase") {
    throw new ImageUploadRepositoryUnavailableError();
  }
  return getSupabaseSignedImageUploadHeaders(environment.SUPABASE_ANON_KEY);
}
