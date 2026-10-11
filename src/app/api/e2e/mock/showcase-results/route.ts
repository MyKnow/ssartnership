import { NextResponse } from "next/server";
import { z } from "zod";
import { isE2eMockMutationEnabled } from "@/lib/e2e-mutation-mode";
import { MOCK_MEMBER_ID } from "@/lib/mock/member";
import { resetProjectShowcaseMockStore } from "@/lib/project-showcase/repository.mock";

export const runtime = "nodejs";

const scenarioSchema = z.object({ winner: z.enum(["submitter", "experiencer", "none", "reset"]) }).strict();

/** Synthetic local fixtures only; production ignores the enabling environment flag. */
export async function POST(request: Request) {
  if (!isE2eMockMutationEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const parsed = scenarioSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_scenario" }, { status: 400 });
  if (parsed.data.winner === "reset") {
    resetProjectShowcaseMockStore();
    return NextResponse.json({ ok: true });
  }
  const now = Date.now();
  const before = new Date(now - 86_400_000).toISOString();
  const store = resetProjectShowcaseMockStore({ event: {
    isActive: false, experienceEndAt: before, announcementStartAt: before,
  } });
  store.projects[0].status = "approved";
  store.projects[0].reviewNote = null;
  store.feedback.push(
    { id: "own-review", projectId: store.projects[0].id, memberId: "synthetic-reviewer", body: "학습 기록과 일정 관리가 편리했어요. 모바일에서도 잘 보여요.", createdAt: before, hiddenAt: null },
    { id: "hidden-review", projectId: store.projects[0].id, memberId: "synthetic-hidden-reviewer", body: "숨김 리뷰 본문", createdAt: before, hiddenAt: before },
    { id: "other-review", projectId: store.projects[1].id, memberId: "synthetic-other-reviewer", body: "다른 출품자의 비공개 리뷰", createdAt: before, hiddenAt: null },
  );
  for (const group of ["submitter", "experiencer"] as const) {
    store.draws.push({ id: `draw-${group}`, group, kind: "initial", replacesWinnerId: null, candidateCount: 1, createdAt: before });
  }
  if (parsed.data.winner !== "none") store.winners.push({
    id: "synthetic-winner", candidateGroup: parsed.data.winner, memberId: MOCK_MEMBER_ID,
    projectTitle: parsed.data.winner === "submitter" ? store.projects[0].title : null,
    maskedName: "테*트", position: 1, status: "active", voidReason: null, deliveredAt: null, createdAt: before,
  });
  return NextResponse.json({ ok: true });
}
