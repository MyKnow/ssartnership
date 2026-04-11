import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import PasswordInput from "@/components/ui/PasswordInput";
import SubmitButton from "@/components/ui/SubmitButton";
import { getServerActionLogContext, logAuthSecurity } from "@/lib/activity-logs";
import {
  authenticatePartnerPortalLogin,
  PartnerPortalLoginError,
} from "@/lib/partner-auth";
import {
  delayPartnerAuthAttempt,
  getPartnerAuthAttemptScope,
  getPartnerAuthBlockingState,
  recordPartnerAuthAttempt,
} from "@/lib/partner-auth-security";
import {
  getPartnerSession,
  setPartnerSession,
} from "@/lib/partner-session";
import { SITE_NAME } from "@/lib/site";
import { isValidEmail } from "@/lib/validation";
import { normalizePartnerLoginId } from "@/lib/partner-utils";

export const metadata: Metadata = {
  title: `업체 포털 로그인 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: false,
  },
};

type PartnerLoginSearchParams = {
  error?: string | string[];
  loginId?: string | string[];
};

function readSearchParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function getLoginErrorMessage(errorCode: string | undefined) {
  switch (errorCode) {
    case "blocked":
      return "로그인이 너무 자주 시도되었습니다. 잠시 후 다시 시도해 주세요.";
    case "setup_required":
      return "초기 설정이 필요합니다. 관리자에게 받은 링크로 먼저 비밀번호를 설정해 주세요.";
    case "inactive_account":
      return "비활성화된 계정입니다. 관리자에게 문의해 주세요.";
    case "not_linked":
      return "해당 계정에 연결된 업체가 없습니다. 관리자에게 문의해 주세요.";
    case "server_error":
      return "로그인 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";
    case "invalid_request":
      return "이메일과 비밀번호를 모두 입력해 주세요.";
    case "invalid_email":
      return "이메일 형식이 올바르지 않습니다.";
    case "invalid_credentials":
      return "이메일 또는 비밀번호가 올바르지 않습니다.";
    default:
      return null;
  }
}

async function loginAction(formData: FormData) {
  "use server";

  const context = await getServerActionLogContext("/partner/login");
  const rawLoginId = String(formData.get("loginId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const loginId = normalizePartnerLoginId(rawLoginId);
  const throttleContext = {
    ipAddress: context.ipAddress ?? null,
    accountIdentifier: loginId || null,
  };
  let redirectTo = "/partner";

  const blockedState = await getPartnerAuthBlockingState("login", throttleContext);
  if (blockedState) {
    await logAuthSecurity({
      ...context,
      eventName: "partner_login",
      status: "blocked",
      actorType: "guest",
      identifier: loginId || null,
      properties: {
        reason: "rate_limit",
        scope: getPartnerAuthAttemptScope(blockedState.identifier),
        blockedUntil: blockedState.blockedUntil,
      },
    });
    await delayPartnerAuthAttempt("login", true);
    redirect(
      `/partner/login?error=blocked${
        loginId ? `&loginId=${encodeURIComponent(loginId)}` : ""
      }`,
    );
  }

  if (!rawLoginId || !password) {
    await logAuthSecurity({
      ...context,
      eventName: "partner_login",
      status: "failure",
      actorType: "guest",
      identifier: loginId || null,
      properties: { reason: "missing_fields" },
    });
    await recordPartnerAuthAttempt("login", throttleContext, false).catch(
      () => undefined,
    );
    await delayPartnerAuthAttempt("login");
    redirect(
      `/partner/login?error=invalid_request${
        loginId ? `&loginId=${encodeURIComponent(loginId)}` : ""
      }`,
    );
  }

  if (!isValidEmail(rawLoginId)) {
    await logAuthSecurity({
      ...context,
      eventName: "partner_login",
      status: "failure",
      actorType: "guest",
      identifier: loginId || null,
      properties: { reason: "invalid_email" },
    });
    await recordPartnerAuthAttempt("login", throttleContext, false).catch(
      () => undefined,
    );
    await delayPartnerAuthAttempt("login");
    redirect(
      `/partner/login?error=invalid_email${
        loginId ? `&loginId=${encodeURIComponent(loginId)}` : ""
      }`,
    );
  }

  try {
    const result = await authenticatePartnerPortalLogin(loginId, password);
    redirectTo = result.account.mustChangePassword
      ? "/partner/change-password"
      : "/partner";
    await setPartnerSession({
      accountId: result.account.id,
      loginId: result.account.loginId,
      displayName: result.account.displayName,
      companyIds: result.companyIds,
      mustChangePassword: result.account.mustChangePassword,
    });
    await recordPartnerAuthAttempt("login", throttleContext, true).catch(
      () => undefined,
    );

    await logAuthSecurity({
      ...context,
      eventName: "partner_login",
      status: "success",
      actorType: "guest",
      identifier: result.account.loginId,
      properties: {
        accountId: result.account.id,
        companyCount: result.companyIds.length,
      },
    });
  } catch (error) {
    if (error instanceof PartnerPortalLoginError) {
      await logAuthSecurity({
        ...context,
        eventName: "partner_login",
        status: "failure",
        actorType: "guest",
        identifier: loginId || null,
        properties: {
          reason: error.code,
        },
      });
      await recordPartnerAuthAttempt("login", throttleContext, false).catch(
        () => undefined,
      );
      await delayPartnerAuthAttempt("login");
      redirect(
        `/partner/login?error=${encodeURIComponent(error.code)}${
          loginId ? `&loginId=${encodeURIComponent(loginId)}` : ""
        }`,
      );
    }

    await logAuthSecurity({
      ...context,
      eventName: "partner_login",
      status: "failure",
      actorType: "guest",
      identifier: loginId || null,
      properties: {
        reason: "exception",
        message: (error as Error).message,
      },
    });
    await recordPartnerAuthAttempt("login", throttleContext, false).catch(
      () => undefined,
    );
    await delayPartnerAuthAttempt("login", true);
    redirect(
      `/partner/login?error=server_error${
        loginId ? `&loginId=${encodeURIComponent(loginId)}` : ""
      }`,
    );
  }

  redirect(redirectTo);
}

export default async function PartnerLoginPage({
  searchParams,
}: {
  searchParams?: Promise<PartnerLoginSearchParams>;
}) {
  const session = await getPartnerSession();
  if (session) {
    redirect(session.mustChangePassword ? "/partner/change-password" : "/partner");
  }

  const params = (await searchParams) ?? {};
  const errorCode = readSearchParam(params.error);
  const defaultLoginId = readSearchParam(params.loginId);
  const errorMessage = getLoginErrorMessage(errorCode);

  return (
    <div className="bg-background">
      <Container className="pb-16 pt-10">
        <div className="mx-auto max-w-2xl">
          <Card className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-primary/10 text-primary">제휴 포털</Badge>
              <Badge className="bg-surface text-muted-foreground">
                업체 세션 분리
              </Badge>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                업체 포털 로그인
              </h1>
              <p className="text-sm leading-6 text-muted-foreground">
                담당자 이메일과 비밀번호로 로그인하면, 연결된 회사의 서비스
                정보를 확인할 수 있습니다.
              </p>
            </div>

            <form action={loginAction} className="space-y-4">
              <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
                담당자 이메일
                <Input
                  name="loginId"
                  type="email"
                  defaultValue={defaultLoginId}
                  placeholder="partner@example.com"
                  autoComplete="email"
                  required
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
                비밀번호
                <PasswordInput
                  name="password"
                  placeholder="초기 설정 후 받은 비밀번호"
                  autoComplete="current-password"
                  required
                />
              </label>

              <FormMessage>
                초기 설정이 끝난 계정만 로그인할 수 있습니다. 아직 설정하지
                않았다면 받은 초기 설정 링크를 먼저 열어 주세요.
              </FormMessage>
              {errorMessage ? (
                <FormMessage variant="error">{errorMessage}</FormMessage>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <SubmitButton pendingText="로그인 중">로그인</SubmitButton>
                <Button variant="ghost" href="/partner/reset">
                  비밀번호 재설정
                </Button>
                <Button variant="ghost" href="/partner/setup">
                  초기 설정 페이지
                </Button>
                <Button variant="ghost" href="/">
                  홈으로
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </Container>
    </div>
  );
}
