import type { SsafyVerifyClientFailure } from "@/lib/ssafy-verify/client-errors";

export default function SsafyVerifyDiagnosticDetails({
  failure,
}: {
  failure: SsafyVerifyClientFailure;
}) {
  return (
    <details
      open
      className="rounded-[1rem] border border-danger/20 bg-danger/5 px-3.5 py-3 text-left text-xs leading-5 text-foreground"
    >
      <summary className="cursor-pointer font-semibold text-danger">
        임시 진단 정보
      </summary>
      <dl className="mt-3 grid gap-2">
        <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-2">
          <dt className="text-muted-foreground">오류 코드</dt>
          <dd className="break-all font-mono font-medium">{failure.errorCode}</dd>
        </div>
        <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-2">
          <dt className="text-muted-foreground">처리 단계</dt>
          <dd className="break-all font-mono font-medium">
            {failure.phase ?? "확인되지 않음"}
          </dd>
        </div>
        <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-2">
          <dt className="text-muted-foreground">요청 ID</dt>
          <dd className="break-all font-mono font-medium">
            {failure.requestId ?? "없음"}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-muted-foreground">
        인증 코드, 토큰, 원문 예외는 보안상 표시하지 않습니다.
      </p>
    </details>
  );
}
