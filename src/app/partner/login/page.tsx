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
import PartnerLoginSetupToast from "@/components/partner/PartnerLoginSetupToast";
import { getPartnerSession } from "@/lib/partner-session";
import { SITE_NAME } from "@/lib/site";
import { loginAction } from "./_actions/login";
import {
  getLoginErrorMessage,
  readSearchParam,
  type PartnerLoginSearchParams,
} from "./_actions/shared";

export const metadata: Metadata = {
  title: `업체 포털 로그인 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: false,
  },
};

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
  const setupStatus = readSearchParam(params.setup);
  const errorMessage = getLoginErrorMessage(errorCode);

  return (
    <div className="bg-background">
      <Container size="wide" className="pb-16 pt-8 lg:pt-10">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(28rem,0.55fr)] xl:items-start">
          <PartnerLoginSetupToast show={setupStatus === "completed"} />
          <Card tone="default" className="space-y-5">
            <Badge variant="primary">제휴 포털</Badge>
            <div className="space-y-3">
              <h1 className="ui-page-title">협력사 운영 공간</h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                연결된 회사와 브랜드 현황, 수정 요청, 리뷰와 알림을 한 화면에서
                관리합니다. 태블릿 이상에서는 운영 정보를 넓은 화면으로 확인할 수
                있습니다.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {["브랜드 현황", "수정 요청", "운영 알림"].map((label) => (
                <div
                  key={label}
                  className="rounded-2xl border border-border bg-surface-inset/80 p-4 text-sm font-medium text-foreground"
                >
                  {label}
                </div>
              ))}
            </div>
          </Card>

          <Card tone="elevated" className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary">제휴 포털</Badge>
            </div>

            <div className="space-y-2">
              <h1 className="ui-page-title">
                업체 포털 로그인
              </h1>
              <p className="ui-body">
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
                초기 설정이 끝난 계정만 로그인할 수 있습니다.<br />아직 설정하지
                않았다면 받은 초기 설정 링크를 먼저 열어 주세요.
              </FormMessage>
              {errorMessage ? (
                <FormMessage variant="error">{errorMessage}</FormMessage>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <SubmitButton pendingText="로그인 중">로그인</SubmitButton>
                <Button variant="secondary" href="/partner/reset">
                  비밀번호 재설정
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </Container>
    </div>
  );
}
