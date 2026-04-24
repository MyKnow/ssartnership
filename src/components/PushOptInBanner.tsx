import { BellAlertIcon } from "@heroicons/react/24/outline";
import Button from "@/components/ui/Button";

export default function PushOptInBanner() {
  return (
    <section className="mt-6 rounded-[28px] border border-border bg-surface-elevated p-5 shadow-raised">
      <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface text-foreground">
              <BellAlertIcon className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-base font-semibold text-foreground">
                새로운 혜택을 놓치지 마세요!
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                신규 제휴, 종료 임박 혜택, 운영 공지를 앱 알림으로 받아볼 수 있습니다.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end sm:items-end sm:self-end">
          <Button href="/notifications">알림 설정하기</Button>
        </div>
      </div>
    </section>
  );
}
