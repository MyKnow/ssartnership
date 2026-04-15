import FormMessage from "@/components/ui/FormMessage";
import SubmitButton from "@/components/ui/SubmitButton";
import type { PartnerCardFormMode } from "@/components/partner-card-form/types";

export default function PartnerFormActions({
  mode,
  partnerId,
  deleteAction,
  submitLabel,
  formError,
}: {
  mode: PartnerCardFormMode;
  partnerId?: string;
  deleteAction?: (formData: FormData) => void | Promise<void>;
  submitLabel?: string;
  formError?: string | null;
}) {
  return (
    <>
      {formError ? <FormMessage variant="error">{formError}</FormMessage> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <SubmitButton pendingText="저장 중" className="w-full sm:w-auto">
          {submitLabel ?? (mode === "create" ? "브랜드 추가" : "수정")}
        </SubmitButton>
      </div>

      {mode === "edit" && deleteAction && partnerId ? (
        <form action={deleteAction}>
          <input type="hidden" name="id" value={partnerId} />
          <SubmitButton
            variant="danger"
            pendingText="삭제 중"
            className="w-full sm:w-auto"
          >
            삭제
          </SubmitButton>
        </form>
      ) : null}
    </>
  );
}
