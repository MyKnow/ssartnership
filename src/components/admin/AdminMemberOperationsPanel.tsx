import AdminSectionHeading from "@/components/admin/AdminSectionHeading";
import Card from "@/components/ui/Card";
import SubmitButton from "@/components/ui/SubmitButton";

type FormAction = (formData: FormData) => void | Promise<void>;

export default function AdminMemberOperationsPanel({
  backfillAction,
  disableGenerationAction,
  hasMoreBackfill,
  backfillCursor,
  backfillBatchSize,
  defaultBatchSize,
  maxBatchSize,
  selectedGeneration,
  generationMattermostLoginTargetCount,
}: {
  backfillAction: FormAction;
  disableGenerationAction: FormAction;
  hasMoreBackfill: boolean;
  backfillCursor: string;
  backfillBatchSize: number;
  defaultBatchSize: number;
  maxBatchSize: number;
  selectedGeneration: number | null;
  generationMattermostLoginTargetCount: number | null;
}) {
  return (
    <section className="grid min-w-0 gap-4">
      <AdminSectionHeading
        title="운영 도구"
        description="목록 확인 후 실행하는 유지보수 작업입니다. 위험한 일괄 변경은 별도 확인이 필요합니다."
      />
      <Card className="grid min-w-0 gap-5">
        <div className="grid min-w-0 gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">회원 프로필 백필</p>
            <p className="mt-1 text-sm text-muted-foreground">
              사진과 프로필 메타데이터가 필요한 회원을 배치 단위로 정비합니다.
            </p>
          </div>
          <form action={backfillAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="cursor" value={backfillCursor} />
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              백필 배치
              <select
                name="batchSize"
                defaultValue={String(backfillBatchSize)}
                className="h-11 rounded-input border border-border bg-surface-control px-3 text-sm text-foreground"
              >
                {[25, defaultBatchSize, maxBatchSize].map((size) => (
                  <option key={size} value={size}>
                    {size}명
                  </option>
                ))}
              </select>
            </label>
            <SubmitButton pendingText={hasMoreBackfill ? "다음 배치 중" : "백필 중"}>
              {hasMoreBackfill ? "다음 배치 실행" : "백필 실행"}
            </SubmitButton>
          </form>
        </div>
        {selectedGeneration !== null ? (
          <div className="grid min-w-0 gap-3 border-t border-border/70 pt-5">
            <div>
              <p className="text-sm font-semibold text-danger">
                {selectedGeneration}기 Mattermost 로그인 중단
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedGeneration}기 중 Mattermost 로그인이 아직 활성인 회원만 중단합니다. 이메일 인증 계정은 계속 사용할 수 있습니다.
              </p>
            </div>
            <div className="grid min-w-0 gap-1 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
              <p className="font-semibold">
                실행 대상 {generationMattermostLoginTargetCount === null
                  ? "확인 중"
                  : `${generationMattermostLoginTargetCount.toLocaleString("ko-KR")}명`}
              </p>
              <p>
                이미 MM 이용이 중단된 회원은 다시 변경하지 않습니다. 같은 작업을 다시 실행해도 대상에서 제외됩니다.
              </p>
            </div>
            <form action={disableGenerationAction} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="generation" value={selectedGeneration} />
              <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  name="confirmedGeneration"
                  value={selectedGeneration}
                  required
                  className="size-4"
                />
                전체 중단 확인
              </label>
              <SubmitButton
                variant="danger"
                pendingText="전환 중"
                disabled={generationMattermostLoginTargetCount === 0}
              >
                {selectedGeneration}기 MM 로그인 중단
              </SubmitButton>
            </form>
          </div>
        ) : null}
      </Card>
    </section>
  );
}
