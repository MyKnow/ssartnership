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
  if (mode === "edit") {
    return (
      <>
        {formError ? <FormMessage variant="error">{formError}</FormMessage> : null}

        <div className="pointer-events-none fixed bottom-safe-bottom-5 left-1/2 z-[45] flex w-full -translate-x-1/2 justify-center px-4 sm:w-auto sm:justify-end md:left-auto md:right-6 md:translate-x-0">
          <div className="pointer-events-auto flex w-full max-w-sm items-center justify-end gap-2 rounded-full border border-border/80 bg-surface/95 p-2 shadow-floating backdrop-blur sm:w-auto">
            <SubmitButton
              pendingText="저장 중"
              className="min-h-12 flex-1 rounded-full px-5 sm:flex-none"
            >
              {submitLabel ?? "브랜드 저장"}
            </SubmitButton>

            {deleteAction && partnerId ? (
              <SubmitButton
                variant="danger"
                pendingText="삭제 중"
                className="min-h-12 flex-1 rounded-full px-5 sm:flex-none"
                formAction={deleteAction}
              >
                삭제
              </SubmitButton>
            ) : null}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {formError ? <FormMessage variant="error">{formError}</FormMessage> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <SubmitButton pendingText="저장 중" className="w-full sm:w-auto">
          {submitLabel ?? "브랜드 추가"}
        </SubmitButton>
      </div>
    </>
  );
}
