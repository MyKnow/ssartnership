import { beforeEach, expect, test, vi } from 'vitest';

const m = vi.hoisted(() => ({ attach: vi.fn(), remove: vi.fn(), get: vi.fn(), owned: vi.fn(), create: vi.fn(), update: vi.fn(), summary: vi.fn() }));
vi.mock('@/lib/activity-logs', () => ({ getRequestLogContext: () => ({}), scheduleProductEventLog: vi.fn() }));
vi.mock('@/lib/request-guards', () => ({ isTrustedSameOriginRequest: () => true }));
vi.mock('@/lib/review-media-storage', () => ({
 buildReviewMediaStoragePath: (p: string, r: string, i: number, u: string) => `reviews/${p}/${r}/${i}-${u}.webp`,
 deleteReviewMediaUrls: m.remove,
}));
vi.mock('@/lib/image-upload/repository.server', () => ({ getImageUploadRepository: () => ({ attach: m.attach }) }));
vi.mock('@/lib/partner-change-requests', () => ({ getPartnerChangeRequestContext: vi.fn() }));
vi.mock('@/lib/partner-session', () => ({ getPartnerSession: vi.fn() }));
vi.mock('@/lib/partner-view-context', () => ({ getPartnerViewerContext: () => ({}) }));
vi.mock('@/lib/repositories', () => ({
 partnerRepository: { getPartnerById: async () => ({ id: 'partner-1' }) },
 partnerReviewRepository: { getPartnerReviewById: m.get, getOwnedPartnerReview: m.owned, createPartnerReview: m.create, updatePartnerReview: m.update, getPartnerReviewSummary: m.summary },
}));
vi.mock('@/lib/user-auth', () => ({ getUserSession: async () => ({ userId: 'member-1' }), isUserSessionLookupUnavailable: async () => false }));
vi.mock('@/lib/server-log', () => ({ logServerError: vi.fn() }));
const reviewId = '11111111-1111-4111-8111-111111111111';
const uploadA = '22222222-2222-4222-8222-222222222222';
const uploadB = '33333333-3333-4333-8333-333333333333';
const objects = new Set<string>();
const attached = new Map<string, string>();
type ReviewRecord = ReturnType<typeof row>;
let stored: ReviewRecord | null = null;
function row(images: string[]) { return { id: reviewId, partnerId: 'partner-1', memberId: 'member-1', images, deletedAt: null, hiddenAt: null }; }
function deferred() { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; }
async function call(method: 'POST' | 'PATCH', ids = [uploadA, uploadB]) {
 const handler = method === 'POST'
   ? (await import('../../src/app/api/partners/[id]/reviews/route')).POST
   : (await import('../../src/app/api/partners/[id]/reviews/[reviewId]/route')).PATCH;
 const req = new Request('http://localhost/api/partners/partner-1/reviews', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reviewId, rating: 5, title: '좋아요', body: '테스트 리뷰 본문입니다.', imagesManifest: { images: ids.map(uploadId => ({ kind: 'upload', uploadId })) } }) });
 const response = await handler(req, { params: Promise.resolve({ id: 'partner-1', reviewId }) });
 return { status: response.status, body: await response.json() };
}
beforeEach(() => {
 vi.clearAllMocks(); objects.clear(); attached.clear(); stored = null;
 m.get.mockImplementation(async () => stored);
 m.owned.mockImplementation(async () => row([]));
 m.summary.mockResolvedValue({ totalCount: 1 });
 m.create.mockImplementation(async (input: { images: string[] }) => (stored = row(input.images)));
 m.update.mockImplementation(async (input: { images: string[] }) => (stored = row(input.images)));
 m.remove.mockImplementation(async (urls: string[]) => urls.forEach(url => objects.delete(url)));
 m.attach.mockImplementation(async (input: { uploadId: string; destination: { path: string } }) => {
   if (attached.has(input.uploadId)) return { url: attached.get(input.uploadId) };
   const url = `https://storage.test/${input.destination.path}`;
   attached.set(input.uploadId, url); objects.add(url); return { url };
 });
});
test('부분 연결 실패 뒤 같은 요청을 재시도해도 저장된 이미지가 존재한다', async () => {
 const normalAttach = m.attach.getMockImplementation()!;
 let fail = true;
 m.attach.mockImplementation(async (input: { uploadId: string; destination: { path: string } }) => { if (input.uploadId === uploadB && fail) { fail = false; throw new Error('second attach failure'); } return normalAttach(input); });
 const first = await call('POST');
 const retry = await call('POST');
 expect(first.status).toBe(503); expect(retry.status).toBe(200);
 const missing = stored!.images.filter((url: string) => !objects.has(url));
 expect(missing).toHaveLength(0);
});
test('중복 요청이 승자 저장 전에 실패해도 공유 이미지를 보존한다', async () => {
 const normalAttach = m.attach.getMockImplementation()!;
 const waiting = deferred(); const release = deferred(); let bCount = 0;
 m.attach.mockImplementation(async (input: { uploadId: string; destination: { path: string } }) => {
   if (input.uploadId === uploadB) {
     bCount += 1;
     if (bCount === 1) { waiting.resolve(); await release.promise; }
     else throw new Error('duplicate second attach failure');
   }
   return normalAttach(input);
 });
 const winnerPromise = call('POST'); await waiting.promise;
 const loser = await call('POST');
 expect(loser.status).toBe(503);
 expect(stored).toBe(null); expect(objects.size).toBe(1);
 release.resolve(); const winner = await winnerPromise;
 const missing = stored!.images.filter((url: string) => !objects.has(url));
 expect(winner.status).toBe(200); expect(missing).toHaveLength(0);
});
test('수정 저장 결과가 불확실해도 연결한 이미지를 보존한다', async () => {
 m.update.mockImplementation(async (input: { images: string[] }) => { stored = row(input.images); throw new Error('TimeoutError: The operation was aborted due to timeout'); });
 const result = await call('PATCH', [uploadA]);
 expect(result.status).toBe(503); expect(stored!.images).toHaveLength(1); expect(objects.size).toBe(1);
});
test('수정 저장 뒤 요약 조회 실패가 저장된 이미지를 삭제하지 않는다', async () => {
 m.summary.mockRejectedValue(new Error('summary unavailable'));
 const result = await call('PATCH', [uploadA]);
 expect(result.status).toBe(503); expect(stored!.images).toHaveLength(1); expect(objects.size).toBe(1);
});
test('같은 리뷰 ID의 다른 이미지 요청도 최초 저장 리뷰를 반환한다', async () => {
 stored = row(['https://storage.test/first-image.webp']);
 const result = await call('POST', [uploadB]);
 expect(result.status).toBe(200); expect(result.body.idempotent).toBe(true); expect(m.attach).not.toHaveBeenCalled();
});

test('리뷰 INSERT가 commit 뒤 응답을 잃어도 저장된 리뷰와 사진을 복구한다', async () => {
 m.create.mockImplementation(async (input: { images: string[] }) => { stored = row(input.images); throw new Error('response lost'); });
 const result = await call('POST', [uploadA]);
 expect(result.status).toBe(200);
 expect(result.body.idempotent).toBe(true);
 expect(stored!.images.every(url => objects.has(url))).toBe(true);
 expect(m.remove).not.toHaveBeenCalled();
});
test('서로 다른 수정 요청도 먼저 연결한 파일을 직접 지우지 않는다', async () => {
 const [first, second] = await Promise.all([call('PATCH', [uploadA]), call('PATCH', [uploadB])]);
 expect(first.status).toBe(200); expect(second.status).toBe(200);
 expect(stored!.images.every(url => objects.has(url))).toBe(true);
 expect(m.remove).not.toHaveBeenCalled();
});
test('최종 파일 부재는 재업로드 필드 오류로 반환한다', async () => {
 const { ImageUploadError } = await import('@/lib/image-upload/repository');
 m.attach.mockRejectedValue(new ImageUploadError('review_image_reupload_required', 'missing'));
 const result = await call('POST', [uploadA]);
 expect(result.status).toBe(400);
 expect(result.body.fieldErrors.images).toBe('리뷰 사진을 다시 업로드해 주세요.');
 expect(m.create).not.toHaveBeenCalled();
});

test.each(['POST', 'PATCH'] as const)('연결 확인 뒤 %s 저장 시 만료된 이미지도 안전한 필드 오류로 복구한다', async (method) => {
 (method === 'POST' ? m.create : m.update).mockRejectedValue(new Error('review_image_reference_invalid'));
 const result = await call(method, [uploadA]);
 expect(result.status).toBe(400);
 expect(result.body.fieldErrors.images).toBe('리뷰 사진을 다시 업로드해 주세요.');
 expect(JSON.stringify(result.body)).not.toContain('review_image_reference_invalid');
 expect(m.remove).not.toHaveBeenCalled();
});
