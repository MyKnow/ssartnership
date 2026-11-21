import sharp from "sharp";
import { createConcurrencyLimiter } from "@/lib/async-concurrency";
import type { ImageTransformPolicy } from "@/lib/image-upload/policy";
import {
  normalizeImageBuffer,
  validateNormalizedImageBuffer,
  type NormalizedImageBuffer,
} from "@/lib/image-upload/transform-core";

export type NormalizeImageUploadInput = {
  source: Buffer;
  declaredContentType?: string | null;
  policy: ImageTransformPolicy;
};

export type NormalizedImageUpload = NormalizedImageBuffer;

/**
 * 업로드 이미지 디코드·리사이즈·WebP 인코딩(HEIF WASM 폴백 포함)의 프로세스 단위 동시 실행 상한.
 * 앱 컨테이너(1.5 CPU/768MB)에서 complete 요청이 여러 개 겹쳐도 픽셀 버퍼가 이 수를 넘지 않는다.
 */
export const IMAGE_UPLOAD_NORMALIZE_CONCURRENCY = 2;

/**
 * libvips 전역 설정을 모듈 초기화 때 한 번만 적용한다. 같은 프로세스의 Next 이미지 옵티마이저도
 * 같은 sharp 인스턴스를 쓰므로 영향을 받는다: 연산 캐시를 끄고 이미지당 스레드를 1개로 둬서
 * 동시 상한(2)과 CPU 할당이 어긋나 스레드가 경합하지 않게 한다.
 */
let sharpRuntimeConfigured = false;

export function configureSharpRuntime(target: Pick<typeof sharp, "cache" | "concurrency"> = sharp) {
  if (sharpRuntimeConfigured) {
    return;
  }
  sharpRuntimeConfigured = true;
  target.cache(false);
  target.concurrency(1);
}

configureSharpRuntime();

const normalizeLimiter = createConcurrencyLimiter(IMAGE_UPLOAD_NORMALIZE_CONCURRENCY);

/** 진단·테스트용: 현재 실행 중·대기 중인 정규화 수. */
export function getImageUploadNormalizeLoad() {
  return {
    active: normalizeLimiter.activeCount,
    pending: normalizeLimiter.pendingCount,
  };
}

export async function normalizeImageUpload(input: NormalizeImageUploadInput) {
  return normalizeLimiter.run(() => normalizeImageBuffer(input));
}

export async function validateNormalizedImageUpload(input: {
  source: Buffer;
  policy: ImageTransformPolicy;
  expectedSha256: string;
}) {
  // 저장 전 재검증은 헤더 메타데이터만 읽어 픽셀을 디코드하지 않으므로 상한 밖에서 실행한다.
  return validateNormalizedImageBuffer(input);
}
