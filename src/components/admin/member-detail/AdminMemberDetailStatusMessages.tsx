import InlineMessage from "@/components/ui/InlineMessage";
import { adminActionErrorMessages } from "@/lib/admin-action-errors";

export default function AdminMemberDetailStatusMessages({
  errorCode,
  emailTransition,
  memberSync,
}: {
  errorCode?: string;
  emailTransition?: string;
  memberSync?: string;
}) {
  const actionError = errorCode
    ? adminActionErrorMessages[errorCode] ?? "요청을 처리하지 못했습니다."
    : null;

  return (
    <>
      {actionError ? (
        <InlineMessage
          tone="danger"
          title="회원 작업을 처리하지 못했습니다."
          description={actionError}
        />
      ) : null}
      {emailTransition === "sent" ? (
        <InlineMessage
          tone="success"
          title="이메일 설정 링크를 발송했습니다."
          description="링크를 완료하기 전까지 기존 MM 연결 이력은 보존되며, MM 아이디 로그인은 사용할 수 없습니다."
        />
      ) : null}
      {memberSync === "updated" ? (
        <InlineMessage
          tone="success"
          title="MM 프로필을 동기화했습니다."
          description="표시 이름, MM 아이디, 트랙, 프로필 사진 중 변경된 정보만 반영했습니다. 캠퍼스와 기수는 변경하지 않습니다."
        />
      ) : null}
      {memberSync === "updatedWithProfilePhotoSkipped" ? (
        <InlineMessage
          tone="warning"
          title="MM 프로필은 반영했지만 사진은 처리하지 못했습니다."
          description="표시 이름, MM 아이디 또는 트랙은 반영됐습니다. MM 프로필 사진은 동기화되지 않았으므로 필요한 경우 사진 관리에서 직접 제출해 주세요."
        />
      ) : null}
      {memberSync === "profilePhotoSkipped" ? (
        <InlineMessage
          tone="warning"
          title="MM 프로필 사진을 처리하지 못했습니다."
          description="표시 이름, MM 아이디와 트랙은 이미 최신입니다. 사진 동기화가 건너뛰어졌으므로 변경 없음이 아니며, 필요한 경우 사진 관리에서 직접 제출해 주세요."
        />
      ) : null}
      {memberSync === "unchanged" ? (
        <InlineMessage
          tone="info"
          title="MM 프로필이 이미 최신 상태입니다."
          description="동기화 가능한 항목에서 변경된 정보가 없습니다."
        />
      ) : null}
      {memberSync === "mattermostUnavailable" ? (
        <InlineMessage
          tone="warning"
          title="MM에서 회원을 찾지 못했습니다."
          description="MM 로그인을 중단했습니다. 회원 신원을 확인한 뒤 아래에서 이메일 로그인 전환을 진행해 주세요."
        />
      ) : null}
    </>
  );
}
