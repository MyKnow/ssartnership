import InlineMessage from "@/components/ui/InlineMessage";
import StatsRow from "@/components/ui/StatsRow";
import type { AdminMemberSummaryReadModel } from "@/lib/admin-member-list.server";
import { formatKoreanDateTimeToMinute } from "@/lib/datetime";

function formatSummaryDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "-"
    : formatKoreanDateTimeToMinute(parsed);
}

export default async function AdminMemberSummarySection({
  summary,
  totalCount,
  currentPageCount,
  page,
  totalPages,
  mustChangePasswordCount,
}: {
  summary: Promise<AdminMemberSummaryReadModel>;
  totalCount: number;
  currentPageCount: number;
  page: number;
  totalPages: number;
  mustChangePasswordCount: number;
}) {
  const result = await summary;

  return (
    <>
      <StatsRow
        items={[
          { label: "전체 회원", value: `${totalCount.toLocaleString()}명`, hint: "현재 필터 기준 결과 수" },
          { label: "현재 페이지", value: `${currentPageCount.toLocaleString()}명`, hint: `${page} / ${totalPages} 페이지` },
          { label: "비밀번호 변경 필요", value: `${mustChangePasswordCount.toLocaleString()}명`, hint: "현재 페이지 기준" },
          {
            label: "정책 확인 필요",
            value: result.hasError ? "확인 불가" : `${result.pendingPolicyCount.toLocaleString()}명`,
            hint: result.hasError
              ? "잠시 후 다시 확인해 주세요"
              : `최근 갱신 ${formatSummaryDate(result.latestUpdatedAt)}`,
          },
        ]}
        minItemWidth="13rem"
      />
      {result.hasError ? (
        <InlineMessage
          tone="warning"
          title="정책 상태 요약을 불러오지 못했습니다."
          description="회원 목록은 계속 사용할 수 있습니다. 잠시 후 다시 확인해 주세요."
        />
      ) : null}
    </>
  );
}
