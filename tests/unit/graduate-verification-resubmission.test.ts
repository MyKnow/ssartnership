import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  upload: vi.fn(),
  promote: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: () => ({ from: mocks.from }) }));
vi.mock("@/lib/member-identifier-reservations", () => ({ hasReservedMemberIdentifier: async () => false }));
vi.mock("@/lib/graduate-verification-storage", () => ({
  MEMBER_PROFILE_IMAGES_BUCKET: "member-profile-images",
  getGraduateVerificationUpload: mocks.upload,
  downloadGraduateVerificationUpload: async () => Buffer.from("%PDF-test"),
  promoteGraduateCertificate: mocks.promote,
  removeGraduateStoredObject: mocks.remove,
  markGraduateVerificationUploadsConsumed: async () => undefined,
}));
vi.mock("@/lib/graduate-verification-files", () => ({
  getGraduateFileSha256: () => "synthetic-hash",
  inspectGraduateCertificatePdf: async () => ({ pageCount: 1, hasPdfMagicBytes: true, isParseable: true, isEncrypted: false, hasJavaScript: false, hasAttachments: false }),
}));
vi.mock("@/lib/graduate-verification-email", () => ({
  sendGraduateAccountSetupEmail: vi.fn(), sendGraduateVerificationRejectionEmail: vi.fn(), sendGraduateVerificationResubmissionEmail: vi.fn(),
}));
vi.mock("@/lib/image-upload/repository.server", () => ({ getImageUploadRepository: vi.fn() }));

import { submitGraduateVerificationRequest } from "../../src/lib/graduate-verification-service";

const input = { challengeId: "challenge", email: "graduate@example.com", legalName: "변경 시도", campus: "대전", generation: 14, consented: true };

describe.each(["graduate_signup", "existing_member_recovery"])("%s resubmission", (kind) => {
  let targets: string[];
  let expired: boolean;
  let verified: boolean;
  let saved: Record<string, unknown>;
  let writes: Record<string, unknown>[];

  beforeEach(() => {
    targets = ["education_period"];
    expired = false;
    verified = true;
    writes = [];
    saved = { id: "request", status: "needs_resubmission", request_kind: kind, legal_name: "기존 이름", campus: "서울", inferred_generation: 15, inferred_cohort: 15, cohort_rule_version: "ssafy-half-year-v1", certificate_storage_path: "synthetic/old.pdf", profile_image_id: "old-photo" };
    mocks.upload.mockReset().mockResolvedValue({ id: "upload", content_type: "application/pdf" });
    mocks.promote.mockReset().mockResolvedValue("synthetic/new.pdf");
    mocks.remove.mockReset().mockResolvedValue(undefined);
    mocks.from.mockReset().mockImplementation((table: string) => {
      let columns = "";
      let patch: Record<string, unknown> | undefined;
      const result = () => {
        if (patch) {
          writes.push(patch);
          saved = { ...saved, ...patch };
          return { data: { id: "request" }, error: null };
        }
        if (table === "graduate_email_challenges") return { data: { id: "challenge", email_normalized: input.email, purpose: "application", request_kind: kind, verified_at: verified ? new Date().toISOString() : null, expires_at: new Date(Date.now() + (expired ? -60_000 : 60_000)).toISOString() }, error: null };
        if (table === "members" || columns === "id") return { data: null, error: null };
        if (table === "graduate_verification_requests") return { data: { ...saved, resubmission_targets: targets }, error: null };
        throw new Error(`Unexpected table: ${table}`);
      };
      const query = {
        select: (value: string) => { columns = value; return query; },
        eq: () => query, neq: () => query, is: () => query, in: () => query, order: () => query, limit: () => query,
        update: (value: Record<string, unknown>) => { patch = value; return query; },
        maybeSingle: async () => result(),
        then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
      };
      return query;
    });
  });

  it("allows a requested cohort correction without replacing name, campus or existing files", async () => {
    const result = await submitGraduateVerificationRequest(input);
    expect(result.inferredGeneration).toBe(14);
    expect(saved).toMatchObject({ legal_name: "기존 이름", campus: "서울", inferred_generation: 14, inferred_cohort: 14, status: "submitted", certificate_storage_path: "synthetic/old.pdf", profile_image_id: "old-photo", resubmission_targets: [] });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(writes).toHaveLength(1);
  });

  it("keeps the stored education and reports its actual cohort when only a certificate is requested", async () => {
    targets = ["certificate"];
    const result = await submitGraduateVerificationRequest({ ...input, certificateUploadId: "upload" });
    expect(saved).toMatchObject({ legal_name: "기존 이름", campus: "서울", inferred_generation: 15, inferred_cohort: 15, certificate_storage_path: "synthetic/new.pdf", profile_image_id: "old-photo", status: "submitted" });
    expect(result.inferredGeneration).toBe(15);
    expect(writes[0]).not.toHaveProperty("legal_name");
    expect(writes[0]).not.toHaveProperty("campus");
  });

  it.each([0, 99, 1.5, "15", null])("rejects invalid or future cohort %j before uploads or writes", async (generation) => {
    await expect(submitGraduateVerificationRequest({ ...input, generation })).rejects.toMatchObject({ code: "submission_invalid" });
    expect(writes).toHaveLength(0);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it.each(["expired", "unverified"])("requires a valid verified challenge: %s", async (state) => {
    expired = state === "expired";
    verified = state !== "unverified";
    await expect(submitGraduateVerificationRequest(input)).rejects.toMatchObject({ code: "application_session_required" });
    expect(writes).toHaveLength(0);
  });
});
