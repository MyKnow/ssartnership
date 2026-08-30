type MemberCleanupResult = {
  error: { code?: string; message: string } | null;
};

export async function rollbackCreatedSignupMember(input: {
  memberId: string;
  originalError: unknown;
  deleteMember: (memberId: string) => PromiseLike<MemberCleanupResult>;
}) {
  let cleanupError: { code?: string; message: string } | null;
  try {
    ({ error: cleanupError } = await input.deleteMember(input.memberId));
  } catch (error) {
    cleanupError = {
      message: error instanceof Error ? error.message : "member_cleanup_failed",
    };
  }
  if (!cleanupError) {
    return;
  }

  console.error("[mm/signup] member rollback failed", {
    memberId: input.memberId,
    code: cleanupError.code ?? null,
    message: cleanupError.message,
  });
  throw new Error("signup_member_cleanup_failed", {
    cause: { originalError: input.originalError, cleanupError },
  });
}
