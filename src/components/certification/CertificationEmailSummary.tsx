import { EnvelopeIcon } from "@heroicons/react/24/outline";
import Badge from "@/components/ui/Badge";
import { CertificationSettingRow } from "@/components/certification/CertificationSettingsList";

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
    <CertificationSettingRow
      icon={<EnvelopeIcon className="h-5 w-5" />}
      title="로그인·복구 이메일"
      description={
        emailVerified && email
          ? email
          : email
            ? `${email} · 로그인과 비밀번호 재설정에 사용하려면 이메일 인증이 필요합니다.`
            : "MM 사용이 어려울 때를 대비해 이메일을 등록할 수 있습니다."
      }
      badge={
        <Badge variant={emailVerified ? "success" : "neutral"}>
          {emailVerified ? "인증 완료" : email ? "미인증" : "미등록"}
        </Badge>
      }
      href={href}
    />
  );
}
