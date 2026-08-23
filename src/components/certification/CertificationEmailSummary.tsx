import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";

export default function CertificationEmailSummary({
  email,
  emailVerified,
  returnTo,
}: {
  email?: string | null;
  emailVerified?: boolean;
  returnTo: string;
}) {
  const params = new URLSearchParams({ returnTo });
  const href = `/certification/email?${params.toString()}`;

  return (
    <Surface
      level="inset"
      padding="lg"
      className="flex w-full flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-foreground">
            로그인·복구 이메일
          </p>
          <Badge variant={emailVerified ? "success" : "neutral"}>
            {emailVerified ? "인증 완료" : email ? "미인증" : "미등록"}
          </Badge>
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {emailVerified && email
            ? `${email} · MM 사용이 어려울 때 로그인과 비밀번호 재설정에 사용할 수 있습니다.`
            : email
              ? `${email} · 로그인과 비밀번호 재설정에 사용하려면 이메일 인증이 필요합니다.`
              : "MM 사용이 어려울 때를 대비해 로그인과 비밀번호 재설정용 이메일을 등록할 수 있습니다."}
        </p>
      </div>
      <Button
        href={href}
        variant="secondary"
        className="w-full shrink-0 sm:w-auto"
      >
        {emailVerified
          ? "이메일 변경하기"
          : email
            ? "이메일 인증하기"
            : "이메일 등록하기"}
      </Button>
    </Surface>
  );
}
