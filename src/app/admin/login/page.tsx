import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { setAdminSession, validateAdminCredentials } from "@/lib/auth";
import { logAuthSecurity } from "@/lib/activity-logs";
import { isBlocked, recordAttempt } from "@/lib/rate-limit";
import ThemeToggle from "@/components/ThemeToggle";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import SubmitButton from "@/components/ui/SubmitButton";
import PasswordInput from "@/components/ui/PasswordInput";
import { validateAdminIdentifier } from "@/lib/validation";
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
  const id = String(formData.get("id") || "");
  const password = String(formData.get("password") || "");
  const idError = validateAdminIdentifier(id);
  if (idError) {
    redirect(`/admin/login?error=invalid&id=${encodeURIComponent(id)}`);
  }

  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");
  const clientIp = forwardedFor?.split(",")[0]?.trim() || "local";
  const context = {
    path: "/admin/login",
    referrer: headerStore.get("referer"),
    userAgent: headerStore.get("user-agent"),
    ipAddress: clientIp,
  };

  if (await isBlocked(clientIp)) {
    await logAuthSecurity({
      ...context,
      eventName: "admin_login",
      status: "blocked",
      actorType: "guest",
      identifier: id || null,
      properties: {
        reason: "rate_limit",
      },
    });
    redirect(`/admin/login?error=rate&id=${encodeURIComponent(id)}`);
  }

  const ok = validateAdminCredentials(id, password);
  await recordAttempt(clientIp, ok);

  if (ok) {
    await setAdminSession();
    await logAuthSecurity({
      ...context,
      eventName: "admin_login",
      status: "success",
      actorType: "admin",
      actorId: process.env.ADMIN_ID ?? "admin",
      identifier: id,
    });
    redirect("/admin");
  }

  await logAuthSecurity({
    ...context,
    eventName: "admin_login",
    status: "failure",
    actorType: "guest",
    identifier: id || null,
    properties: {
      reason: "invalid_credentials",
    },
  });
  redirect(`/admin/login?error=1&id=${encodeURIComponent(id)}`);
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; id?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const hasError = params.error === "1";
  const isRateLimited = params.error === "rate";
  const invalidId = params.error === "invalid";
  const defaultId = params.id ?? "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <Card className="w-full max-w-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Admin Login
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">
              관리자 로그인
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
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
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
            Password
            <PasswordInput name="password" placeholder="비밀번호" required />
          </label>

          {hasError ? (
            <p className="text-xs font-semibold text-danger">
              로그인 정보가 일치하지 않습니다.
            </p>
          ) : null}
          {isRateLimited ? (
            <p className="text-xs font-semibold text-danger">
              로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.
            </p>
          ) : null}
          {invalidId ? (
            <p className="text-xs font-semibold text-danger">
              아이디는 @ 없이 입력해 주세요.
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
