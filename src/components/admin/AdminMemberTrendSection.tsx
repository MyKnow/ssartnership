import AdminMemberTrendChart from "@/components/admin/AdminMemberTrendChart";
import InlineMessage from "@/components/ui/InlineMessage";
import {
  ADMIN_MEMBER_TREND_SAMPLE_LIMIT,
  type AdminMemberTrendReadModel,
} from "@/lib/admin-member-list.server";

export default async function AdminMemberTrendSection({
  trend,
}: {
  trend: Promise<AdminMemberTrendReadModel>;
}) {
  const result = await trend;

  if (result.hasError) {
    return (
      <InlineMessage
        tone="warning"
        title="회원 유입 추이를 불러오지 못했습니다."
        description="회원 목록은 계속 사용할 수 있습니다. 잠시 후 다시 확인해 주세요."
      />
    );
  }

  return (
    <>
      <AdminMemberTrendChart createdAts={result.createdAts} />
      {result.isSampled ? (
        <InlineMessage
          tone="warning"
          title="회원 유입 추이는 최근 샘플 기준입니다."
          description={`성능 보호를 위해 현재 필터의 최근 ${ADMIN_MEMBER_TREND_SAMPLE_LIMIT.toLocaleString("ko-KR")}명 생성 이력만 차트에 반영합니다.`}
        />
      ) : null}
    </>
  );
}
