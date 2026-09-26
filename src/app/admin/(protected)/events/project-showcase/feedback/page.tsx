import Link from "next/link";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminShell from "@/components/admin/AdminShell";
import ShowcaseFeedbackVisibilityButton from "@/components/admin/ShowcaseFeedbackVisibilityButton";
import { requireAdminPermission } from "@/lib/admin-access";
import { canAdmin } from "@/lib/admin-permissions";
import { projectShowcaseRepository } from "@/lib/project-showcase";

export const dynamic = "force-dynamic";

const FEEDBACK_PATH = "/admin/events/project-showcase/feedback";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function AdminShowcaseFeedbackPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdminPermission("events", "read", { path: FEEDBACK_PATH });
  const params = (await searchParams) ?? {};
  const hidden = params.view === "hidden";
  const feedback = await projectShowcaseRepository.listAdminFeedback({ hidden });
  const canUpdate = canAdmin(admin.account.permissions, "events", "update");

  return (
    <AdminShell title="쇼케이스 피드백" backHref="/admin/events/project-showcase" backLabel="쇼케이스 운영">
      <div className="grid min-w-0 gap-6">
        <AdminPageHeader
          eyebrow="SSAFY PROJECT SHOWCASE"
          title="피드백 관리"
          description="욕설이나 개인정보가 담긴 피드백을 숨깁니다. 숨겨도 이미 인정된 유효 체험과 추첨권은 유지되고, 출품자에게만 보이지 않아요. 작성자 정보는 표시하지 않아요."
        />
        <nav aria-label="피드백 공개 상태" className="flex gap-2">
          {[
            { key: "visible", label: "공개 중", href: FEEDBACK_PATH, active: !hidden },
            { key: "hidden", label: "숨김", href: `${FEEDBACK_PATH}?view=hidden`, active: hidden },
          ].map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${tab.active ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface text-muted-foreground hover:text-foreground"}`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        {feedback.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">
            {hidden ? "숨긴 피드백이 없어요." : "아직 받은 피드백이 없어요."}
          </div>
        ) : (
          <ul className="grid gap-3">
            {feedback.map((item) => (
              <li key={item.id} className="grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:p-5">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {item.projectTitle} · <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{item.body}</p>
                </div>
                {canUpdate ? <ShowcaseFeedbackVisibilityButton feedbackId={item.id} hidden={item.hidden} /> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
