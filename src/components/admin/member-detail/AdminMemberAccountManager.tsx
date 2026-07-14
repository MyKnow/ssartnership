"use client";

import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import AdminSectionHeading from "@/components/admin/AdminSectionHeading";
import Select from "@/components/ui/Select";
import SubmitButton from "@/components/ui/SubmitButton";

type FormAction = (formData: FormData) => void | Promise<void>;

export default function AdminMemberAccountManager({
  member,
  updateAction,
  deleteAction,
  canUpdate,
  canDelete,
}: {
  member: {
    id: string;
    displayName: string;
    campus: string;
    generation: number;
    mmUsername: string;
    manualLoginId: string | null;
    mustChangePassword: boolean;
  };
  updateAction: FormAction;
  deleteAction: FormAction;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  if (!canUpdate && !canDelete) {
    return null;
  }

  return (
    <Card tone="default" className="grid min-w-0 gap-4">
      <AdminSectionHeading
        title="계정 관리"
        description="수정과 삭제는 회원 상세에서만 처리합니다."
      />

      {canUpdate ? (
        <form action={updateAction} className="grid min-w-0 gap-3">
          <input type="hidden" name="id" value={member.id} />
          <label className="grid min-w-0 gap-2 text-sm font-medium text-foreground">
            표시 이름
            <Input name="displayName" defaultValue={member.displayName} />
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-medium text-foreground">
            캠퍼스
            <Input name="campus" defaultValue={member.campus} />
          </label>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <label className="grid min-w-0 gap-2 text-sm font-medium text-foreground">
              기수
              <Input
                type="number"
                min={0}
                max={99}
                name="generation"
                defaultValue={member.generation}
              />
            </label>
            <label className="grid min-w-0 gap-2 text-sm font-medium text-foreground">
              비밀번호 상태
              <Select
                name="mustChangePassword"
                defaultValue={member.mustChangePassword ? "true" : "false"}
              >
                <option value="false">정상</option>
                <option value="true">변경 필요</option>
              </Select>
            </label>
          </div>
          <SubmitButton pendingText="저장 중" className="w-full">
            회원 정보 저장
          </SubmitButton>
        </form>
      ) : null}

      {canDelete ? (
        <form
          action={deleteAction}
          onSubmit={(event) => {
            if (
              !window.confirm(
                `정말 ${member.displayName}(${member.manualLoginId ?? `@${member.mmUsername}`}) 회원을 삭제하시겠습니까?`,
              )
            ) {
              event.preventDefault();
            }
          }}
          className="border-t border-border/70 pt-4"
        >
          <input type="hidden" name="id" value={member.id} />
          <SubmitButton variant="danger" pendingText="삭제 중" className="w-full">
            회원 삭제
          </SubmitButton>
        </form>
      ) : null}
    </Card>
  );
}
