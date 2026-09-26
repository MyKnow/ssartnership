import Link from "next/link";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminShell from "@/components/admin/AdminShell";
import {
  ShowcaseAnnouncementCopy,
  ShowcaseCandidateExclusionControl,
  ShowcaseDrawButton,
  ShowcaseSettleButton,
  ShowcaseWinnerControls,
} from "@/components/admin/ShowcaseDrawControls";
import { requireAdminPermission } from "@/lib/admin-access";
import { canAdmin } from "@/lib/admin-permissions";
import { getShowcasePhase, projectShowcaseRepository } from "@/lib/project-showcase";
import { buildShowcaseAnnouncement } from "@/lib/project-showcase/draw";
import { formatShowcaseDateTime } from "@/lib/project-showcase/format";
import { SHOWCASE_ADMIN_PHASE_LABELS, SHOWCASE_PRIZES } from "@/lib/project-showcase/labels";
import type { ShowcaseCandidateGroup } from "@/lib/project-showcase/types";

export const dynamic = "force-dynamic";

const DRAW_PATH = "/admin/events/project-showcase/draw";
const DAY = 24 * 60 * 60 * 1000;

export default async function AdminShowcaseDrawPage() {
  const admin = await requireAdminPermission("events", "read", { path: DRAW_PATH });
  const [event, state, submitters, experiencers, winners] = await Promise.all([
    projectShowcaseRepository.getEvent(),
    projectShowcaseRepository.getDrawState(),
    projectShowcaseRepository.listSubmitterCandidates(),
    projectShowcaseRepository.listExperiencerCandidates(),
    projectShowcaseRepository.listAdminWinners(),
  ]);
  const phase = getShowcasePhase(event);
  const canUpdate = canAdmin(admin.account.permissions, "events", "update");
  const drawWindowOpen = Boolean(event?.isActive) && !state.settledAt
    && (phase === "verification" || phase === "announcement" || phase === "closed");
  const locked = !canUpdate || !drawWindowOpen;
  const windowReason = !canUpdate
    ? "이벤트 수정 권한이 필요해요."
    : state.settledAt ? "정산을 마쳐 더 바꿀 수 없어요."
    : !drawWindowOpen ? "체험 기간이 끝난 뒤에 추첨과 검증을 할 수 있어요." : null;
  const activeWinners = winners.filter((winner) => winner.status === "active");
  const announcement = buildShowcaseAnnouncement(event?.title ?? "내 프로젝트를 소개합니다!", activeWinners);
  const eligibleProjects = submitters.filter((candidate) => candidate.memberId && !candidate.exclusion && !candidate.alreadyWon);
  const eligibleSubmitters = new Set(eligibleProjects.map((candidate) => candidate.memberId)).size;
  const eligibleExperiencers = experiencers.filter((candidate) => !candidate.exclusion && !candidate.alreadyWon);
  const eligibleTickets = eligibleExperiencers.reduce((total, candidate) => total + candidate.tickets, 0);
  const drawReason = (group: ShowcaseCandidateGroup) => {
    if (windowReason) return windowReason;
    if (group === "submitter" && state.submitterDrawn) return "이미 출품 추첨을 실행했어요.";
    if (group === "experiencer" && state.experiencerDrawn) return "이미 체험 추첨을 실행했어요.";
    if (group === "experiencer" && !state.submitterDrawn) return "출품 추첨을 먼저 실행해 주세요.";
    return null;
  };
  const announcementStarted = phase === "announcement" || phase === "closed";
  const settleReason = !canUpdate ? "이벤트 수정 권한이 필요해요." : state.settledAt ? null : !announcementStarted ? "결과 발표가 시작된 뒤 정산할 수 있어요." : null;

  return (
    <AdminShell title="추첨·발표" backHref="/admin/events/project-showcase" backLabel="쇼케이스 운영">
      <div className="grid min-w-0 gap-6">
        <AdminPageHeader
          eyebrow="SSAFY PROJECT SHOWCASE"
          title="검증·추첨·발표"
          description="추첨 전에 외부인, 중복 계정, 허위 기록을 후보에서 제외하고 출품 → 체험 순서로 추첨합니다. 한 사람은 경품을 최대 1개 받고, 결과는 발표 시작부터 공개돼요."
        />

        <section className="grid gap-3 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-4 sm:p-6" aria-label="추첨 진행 상태">
          {[
            ["현재 단계", SHOWCASE_ADMIN_PHASE_LABELS[phase]],
            ["출품 추첨", state.submitterDrawn ? "완료" : "대기"],
            ["체험 추첨", state.experiencerDrawn ? "완료" : "대기"],
            ["정산", state.settledAt
              ? `완료 · ${formatShowcaseDateTime(new Date(new Date(state.settledAt).getTime() + 30 * DAY).toISOString()) ?? ""} 파기${state.purgedAt ? " 완료" : " 예정"}`
              : "대기"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-surface-muted/60 p-3">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="showcase-submitter-candidates">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="showcase-submitter-candidates" className="text-lg font-bold text-foreground">출품 후보 <span className="text-sm font-semibold text-muted-foreground">{submitters.length}건</span></h2>
              <p className="mt-1 text-sm text-muted-foreground">승인된 프로젝트 1개당 기회 1개예요. 당첨되면 그 회원의 나머지 출품은 제외해요. {SHOWCASE_PRIZES.submitter.prize} · 최대 {event?.submitterSelectionCount ?? 0}명</p>
            </div>
            <ShowcaseDrawButton group="submitter" label={`출품 추첨 실행 (대상 ${eligibleSubmitters}명 · ${eligibleProjects.length}장)`} disabledReason={drawReason("submitter")} />
          </div>
          {submitters.length === 0 ? <p className="text-sm text-muted-foreground">승인된 출품이 없어요.</p> : (
            <ul className="grid gap-2">
              {submitters.map((candidate) => (
                <li key={candidate.projectId} className="grid gap-2 rounded-xl border border-border px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] sm:items-start">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{candidate.projectTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      대표자 {candidate.ownerDisplayName}{candidate.alreadyWon ? " · 당첨" : ""}{candidate.exclusion ? " · 제외됨" : ""}
                    </p>
                  </div>
                  <ShowcaseCandidateExclusionControl group="submitter" targetId={candidate.projectId} exclusion={candidate.exclusion} disabled={locked} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="showcase-experiencer-candidates">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="showcase-experiencer-candidates" className="text-lg font-bold text-foreground">체험 후보 <span className="text-sm font-semibold text-muted-foreground">{experiencers.length}명</span></h2>
              <p className="mt-1 text-sm text-muted-foreground">추첨권(피드백을 남긴 프로젝트 수)에 비례해 뽑아요. {SHOWCASE_PRIZES.experiencer.prize} · 최대 {event?.experiencerSelectionCount ?? 0}명</p>
            </div>
            <ShowcaseDrawButton group="experiencer" label={`체험 추첨 실행 (대상 ${eligibleExperiencers.length}명 · ${eligibleTickets}장)`} disabledReason={drawReason("experiencer")} />
          </div>
          {experiencers.length === 0 ? <p className="text-sm text-muted-foreground">추첨권을 가진 체험자가 없어요.</p> : (
            <ul className="grid gap-2">
              {experiencers.map((candidate) => (
                <li key={candidate.memberId} className="grid gap-2 rounded-xl border border-border px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] sm:items-start">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{candidate.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      추첨권 {candidate.tickets}장{candidate.alreadyWon ? " · 당첨" : ""}{candidate.exclusion ? " · 제외됨" : ""}
                    </p>
                  </div>
                  <ShowcaseCandidateExclusionControl group="experiencer" targetId={candidate.memberId} exclusion={candidate.exclusion} disabled={locked} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="showcase-winners-heading">
          <div>
            <h2 id="showcase-winners-heading" className="text-lg font-bold text-foreground">당첨자 <span className="text-sm font-semibold text-muted-foreground">유효 {activeWinners.length}</span></h2>
            <p className="mt-1 text-sm text-muted-foreground">중복 당첨, 수령 불가, 검증 실패는 무효 처리한 뒤 1명씩 재추첨해요. 재추첨할 후보가 없으면 그 경품은 미집행으로 남아요.</p>
          </div>
          {winners.length === 0 ? <p className="text-sm text-muted-foreground">아직 추첨하지 않았어요.</p> : (
            <ul className="grid gap-2">
              {winners.map((winner) => (
                <li key={winner.id} className={`grid gap-2 rounded-xl border px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] sm:items-start ${winner.status === "voided" ? "border-dashed border-border opacity-80" : "border-border"}`}>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-primary">{SHOWCASE_PRIZES[winner.candidateGroup].title} #{winner.position}</p>
                    <p className="mt-1 font-medium text-foreground">
                      {winner.projectTitle ? `${winner.projectTitle} · ` : ""}{winner.maskedName}
                    </p>
                  {winner.memberId && canAdmin(admin.account.permissions, "members", "read") ? (
                    <Link href={`/admin/members/${winner.memberId}`} className="text-sm font-semibold text-primary underline">회원 연락처 확인 · 구글폼 안내</Link>
                  ) : null}
                  </div>
                  <ShowcaseWinnerControls winner={winner} disabled={locked} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid gap-3 rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="showcase-announcement-heading">
          <h2 id="showcase-announcement-heading" className="text-lg font-bold text-foreground">Mattermost 공지 문구</h2>
          <p className="text-sm text-muted-foreground">유효 당첨만 이름 일부를 가려 담았어요. 공지는 직접 게시해 주세요. 공개 페이지에는 발표 시작부터 같은 명단이 보여요.</p>
          <ShowcaseAnnouncementCopy text={announcement} />
        </section>

        <section className="grid gap-3 rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="showcase-settle-heading">
          <h2 id="showcase-settle-heading" className="text-lg font-bold text-foreground">정산</h2>
          <p className="text-sm text-muted-foreground">모든 경품 발송과 정산을 마치면 기록해 주세요. 30일 뒤 매일 도는 예약 작업이 체험·피드백·관심·추첨 기록의 회원 연결을 파기해요.</p>
          {state.settledAt ? (
            <p className="text-sm font-semibold text-foreground">정산 완료 · {formatShowcaseDateTime(state.settledAt, { withTime: true })}</p>
          ) : (
            <ShowcaseSettleButton disabledReason={settleReason} />
          )}
        </section>
      </div>
    </AdminShell>
  );
}
