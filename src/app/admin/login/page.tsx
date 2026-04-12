import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { setAdminSession, validateAdminCredentials } from "@/lib/auth";
import { logAuthSecurity } from "@/lib/activity-logs";
import {
  ADMIN_ACCOUNT_RATE_LIMIT,
  getBlockingState,
  recordAttemptBatch,
} from "@/lib/rate-limit";
import ThemeToggle from "@/components/ThemeToggle";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import SubmitButton from "@/components/ui/SubmitButton";
import PasswordInput from "@/components/ui/PasswordInput";
import {
  delay,
  getAdminRateLimitKeys,
  inspectAdminLoginFormData,
  sanitizeAdminLoginSearchParams,
} from "@/lib/admin-security";
import {
  normalizeAdminIdentifier,
  validateAdminIdentifier,
  validateAdminPasswordInput,
} from "@/lib/validation";
import { SITE_NAME } from "@/lib/site";

export const metadata = {
  title: `관리자 로그인 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: true,
  },
};

async function loginAction(formData: FormData) {
  "use server";
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");
  const clientIp = forwardedFor?.split(",")[0]?.trim() || "local";
  const context = {
    path: "/admin/login",
    referrer: headerStore.get("referer"),
    userAgent: headerStore.get("user-agent"),
    ipAddress: clientIp,
  };
  const { invalidShape, unexpectedFields, id, password } =
    inspectAdminLoginFormData(formData);

  if (invalidShape) {
    await logAuthSecurity({
      ...context,
      eventName: "admin_login",
      status: "blocked",
      actorType: "guest",
      identifier: null,
      properties: {
        reason: "suspicious_parameter",
        location: "form_data",
        unexpectedFields: unexpectedFields.slice(0, 5),
      },
    });
    await delay(600);
    redirect("/admin/login?error=invalid_request");
  }

  const idError = validateAdminIdentifier(id);
  if (idError) {
    await logAuthSecurity({
      ...context,
      eventName: "admin_login",
      status: "blocked",
      actorType: "guest",
      identifier: null,
      properties: {
        reason: "validation_failure",
        field: "id",
      },
    });
    await delay(600);
    redirect("/admin/login?error=invalid_identifier");
  }

  const passwordError = validateAdminPasswordInput(password);
  if (passwordError) {
    await logAuthSecurity({
      ...context,
      eventName: "admin_login",
      status: "blocked",
      actorType: "guest",
      identifier: normalizeAdminIdentifier(id),
      properties: {
        reason: "validation_failure",
        field: "password",
      },
    });
    await delay(600);
    redirect(
      `/admin/login?error=invalid_request&id=${encodeURIComponent(
        normalizeAdminIdentifier(id),
      )}`,
    );
  }

  const normalizedId = normalizeAdminIdentifier(id);
  const rateLimitKeys = getAdminRateLimitKeys(clientIp, normalizedId);
  const ipRateLimitKeys = rateLimitKeys.filter((key) => key.startsWith("ip:"));
  const accountRateLimitKeys = rateLimitKeys.filter((key) =>
    key.startsWith("account:"),
  );
  const ipBlock = await getBlockingState(ipRateLimitKeys);
  const accountBlock = await getBlockingState(
    accountRateLimitKeys,
    ADMIN_ACCOUNT_RATE_LIMIT,
  );
  const blockedState = accountBlock ?? ipBlock;

  if (blockedState) {
    await logAuthSecurity({
      ...context,
      eventName: "admin_login",
      status: "blocked",
      actorType: "guest",
      identifier: normalizedId || null,
      properties: {
        reason: "rate_limit",
        scope: blockedState.identifier.startsWith("account:") ? "account" : "ip",
        blockedUntil: blockedState.blockedUntil,
      },
    });
    await delay(600);
    redirect(
      `/admin/login?error=rate_limited&id=${encodeURIComponent(normalizedId)}`,
    );
  }

  const ok = validateAdminCredentials(normalizedId, password);
  await Promise.all([
    recordAttemptBatch(ipRateLimitKeys, ok),
    recordAttemptBatch(accountRateLimitKeys, ok, ADMIN_ACCOUNT_RATE_LIMIT),
  ]);

  if (ok) {
    await setAdminSession();
    await logAuthSecurity({
      ...context,
      eventName: "admin_login",
      status: "success",
      actorType: "admin",
      actorId: process.env.ADMIN_ID ?? "admin",
      identifier: normalizedId,
    });
    redirect("/admin");
  }

  await delay(600);
  await logAuthSecurity({
    ...context,
    eventName: "admin_login",
    status: "failure",
    actorType: "guest",
    identifier: normalizedId || null,
    properties: {
      reason: "invalid_credentials",
    },
  });
  redirect(
    `/admin/login?error=invalid_credentials&id=${encodeURIComponent(normalizedId)}`,
  );
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const { errorCode, defaultId, suspiciousReasons } =
    sanitizeAdminLoginSearchParams(params);

  if (suspiciousReasons.length > 0) {
    const headerStore = await headers();
    await logAuthSecurity({
      path: "/admin/login",
      referrer: headerStore.get("referer"),
      userAgent: headerStore.get("user-agent"),
      ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || "local",
      eventName: "admin_login",
      status: "blocked",
      actorType: "guest",
      identifier: null,
      properties: {
        reason: "suspicious_parameter",
        location: "query_string",
        details: suspiciousReasons,
      },
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <Card tone="elevated" className="w-full max-w-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="ui-kicker">
              Admin Login
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">
              관리자 로그인
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              href="/"
              size="icon"
              ariaLabel="사용자 화면으로"
              title="사용자 화면으로"
            >
              <svg
                width={18}
                height={18}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Button>
            <ThemeToggle />
          </div>
        </div>

        <form className="mt-6 flex flex-col gap-4" action={loginAction}>
          <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
            ID
            <Input
              name="id"
              placeholder="운영진 ID"
              required
              defaultValue={defaultId}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              maxLength={64}
              pattern="[A-Za-z0-9._-]+"
              spellCheck={false}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
            Password
            <PasswordInput
              name="password"
              placeholder="비밀번호"
              required
              autoComplete="current-password"
              maxLength={256}
            />
          </label>

          {errorCode === "invalid_credentials" ? (
            <p className="text-xs font-semibold text-danger">
              로그인 정보가 일치하지 않습니다.
            </p>
          ) : null}
          {errorCode === "rate_limited" ? (
            <p className="text-xs font-semibold text-danger">
              로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.
            </p>
          ) : null}
          {errorCode === "invalid_identifier" ? (
            <p className="text-xs font-semibold text-danger">
              아이디는 3~64자의 영문, 숫자, ., _, -만 사용할 수 있습니다.
            </p>
          ) : null}
          {errorCode === "invalid_request" ? (
            <p className="text-xs font-semibold text-danger">
              잘못된 요청 형식입니다.
            </p>
          ) : null}
          {errorCode === "access_denied" ? (
            <p className="text-xs font-semibold text-danger">
              관리자 인증이 필요합니다.
            </p>
          ) : null}

          <SubmitButton className="mt-2 w-full" pendingText="로그인 중">
            로그인
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}
