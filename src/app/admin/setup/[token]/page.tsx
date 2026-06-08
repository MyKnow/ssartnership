import { redirect } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import PasswordInput from "@/components/ui/PasswordInput";
import SubmitButton from "@/components/ui/SubmitButton";
import {
  completeAdminInitialSetup,
  getAdminInitialSetupAccount,
} from "@/lib/admin-accounts";
import { setAdminSession } from "@/lib/auth";
import { logAuthSecurity } from "@/lib/activity-logs";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `관리자 초기 설정 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: false,
  },
};

async function completeSetupAction(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  try {
    const account = await completeAdminInitialSetup({
      token,
      password,
      passwordConfirm,
    });
    await setAdminSession(account);
    await logAuthSecurity({
      eventName: "admin_login",
      status: "success",
      actorType: "admin",
      actorId: account.id,
      identifier: account.loginId,
      path: "/admin/setup/[token]",
      properties: {
        reason: "initial_setup_complete",
      },
    });
  } catch (error) {
    redirect(
      `/admin/setup/${encodeURIComponent(token)}?error=${encodeURIComponent(
        error instanceof Error ? error.message : "초기 설정에 실패했습니다.",
      )}`,
    );
  }

  redirect("/admin");
}

export default async function AdminSetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const query = (await searchParams) ?? {};
  const account = await getAdminInitialSetupAccount(token);

  if (!account) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <Card tone="elevated" className="w-full max-w-md text-center">
          <h1 className="text-xl font-semibold text-foreground">
            초기 설정 링크가 유효하지 않습니다.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            링크가 만료되었거나 이미 사용되었습니다. 기존 관리자에게 새 링크를 요청해 주세요.
          </p>
          <div className="mt-6">
            <Button href="/admin/login" variant="secondary">
              로그인으로 이동
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <Card tone="elevated" className="w-full max-w-md">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="ui-kicker">Admin Setup</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">
              관리자 초기 설정
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {account.displayName} 계정의 비밀번호를 설정합니다.
            </p>
          </div>
          <ThemeToggle />
        </div>

        {query.error ? (
          <div className="mt-5">
            <FormMessage variant="error">{query.error}</FormMessage>
          </div>
        ) : null}

        <form action={completeSetupAction} className="mt-6 grid gap-4">
          <input type="hidden" name="token" value={token} />
          <label className="grid gap-2 text-sm font-medium text-foreground">
            새 비밀번호
            <PasswordInput name="password" required autoComplete="new-password" />
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            새 비밀번호 확인
            <PasswordInput
              name="passwordConfirm"
              required
              autoComplete="new-password"
            />
          </label>
          <SubmitButton pendingText="설정 중">설정 완료</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
