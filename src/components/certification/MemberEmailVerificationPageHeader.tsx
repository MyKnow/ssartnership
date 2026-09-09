import PageHeader from "@/components/ui/PageHeader";

export default function MemberEmailVerificationPageHeader({
  emailRegistrationRequired,
  completionHref,
}: {
  emailRegistrationRequired: boolean;
  completionHref: string;
}) {
  return (
    <PageHeader
      title={emailRegistrationRequired ? "이메일 등록이 필요해요" : "로그인·복구 이메일"}
      description={
        emailRegistrationRequired
          ? "Mattermost를 사용할 수 없는 계정이에요. 계속 이용하려면 이메일을 등록하고 인증해 주세요."
          : "로그인과 비밀번호 재설정에 사용할 이메일을 인증합니다."
      }
      {...(emailRegistrationRequired
        ? {}
        : {
            backHref: completionHref,
            backLabel: "이전 화면으로 돌아가기",
          })}
      className="border-b-0"
    />
  );
}
