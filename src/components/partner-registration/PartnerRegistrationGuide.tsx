import { ChevronDown } from "lucide-react";
import Card from "@/components/ui/Card";

function GuideContent() {
  return (
    <>
      <ul className="grid min-w-0 gap-2 text-sm leading-6 text-muted-foreground">
        <li className="min-w-0 rounded-[1rem] border border-border/70 bg-surface px-4 py-3">
          <strong className="block truncate text-foreground">
            한 제휴처, 여러 지점 가능
          </strong>
          <span className="line-clamp-2">
            공통 정보는 한 번 입력하고 지점 단계에서 여러 지점을 추가합니다.
          </span>
        </li>
        <li className="min-w-0 rounded-[1rem] border border-border/70 bg-surface px-4 py-3">
          <strong className="block truncate text-foreground">
            신규 카테고리 가능
          </strong>
          <span className="line-clamp-2">
            목록에 없으면 새 카테고리명을 그대로 입력해 주세요.
          </span>
        </li>
        <li className="min-w-0 rounded-[1rem] border border-border/70 bg-surface px-4 py-3">
          <strong className="block truncate text-foreground">연락처 분리</strong>
          <span className="line-clamp-2">
            제휴처 전화번호와 파트너사 담당자 번호를 별도로 입력합니다.
          </span>
        </li>
      </ul>
      <div className="min-w-0 rounded-[1rem] border border-primary/15 bg-primary-soft px-4 py-3">
        <p className="truncate text-sm font-semibold text-primary">이후 처리</p>
        <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
          제출 내용은 바로 공개되지 않고 관리자 검토 큐에 접수됩니다.
        </p>
      </div>
    </>
  );
}

export default function PartnerRegistrationGuide() {
  return (
    <aside className="min-w-0 xl:sticky xl:top-24">
      <details className="group min-w-0 rounded-panel border border-border bg-surface-inset shadow-none xl:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:content-none">
          <span className="min-w-0">
            <span className="ui-kicker block">Guide</span>
            <span className="block truncate text-sm font-semibold text-foreground">
              제출 전 확인
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid min-w-0 gap-3 border-t border-border/70 p-4">
          <GuideContent />
        </div>
      </details>

      <Card tone="muted" padding="md" className="hidden min-w-0 gap-3 xl:grid">
        <div className="min-w-0">
          <p className="ui-kicker">Guide</p>
          <h2 className="mt-1 truncate text-lg font-semibold text-foreground">
            제출 전 확인
          </h2>
        </div>
        <GuideContent />
      </Card>
    </aside>
  );
}
