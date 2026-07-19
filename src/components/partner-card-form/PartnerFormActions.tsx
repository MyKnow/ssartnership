import FormMessage from "@/components/ui/FormMessage";
import Button from "@/components/ui/Button";
import SubmitButton from "@/components/ui/SubmitButton";
import type { ImageUploadFormDraftStatus } from "@/components/media/useImageUploadFormDraft";
import type { PartnerCardFormMode } from "@/components/partner-card-form/types";

export default function PartnerFormActions({
  mode,
  partnerId,
  deleteAction,
  submitLabel,
  formError,
  draftStatus,
  onSaveDraft,
  onClearDraft,
}: {
  mode: PartnerCardFormMode;
  partnerId?: string;
  deleteAction?: (formData: FormData) => void | Promise<void>;
  submitLabel?: string;
  formError?: string | null;
  draftStatus?: ImageUploadFormDraftStatus;
  onSaveDraft?: () => void;
  onClearDraft?: () => void;
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
              {submitLabel ?? "제휴처 저장"}
            </SubmitButton>

            {deleteAction && partnerId ? (
              <SubmitButton
                variant="danger"
                pendingText="삭제 중"
                className="min-h-12 flex-1 rounded-full px-5 sm:flex-none"
                formAction={deleteAction}
                name="partnerFormIntent"
                value="delete"
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

      <div className="grid gap-3 rounded-[1rem] border border-border/70 bg-surface-inset p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0" role="status" aria-live="polite">
          <p className="text-sm font-semibold text-foreground">
            {draftStatus === "saving"
              ? "임시 저장 중"
              : draftStatus === "saved"
                ? "임시 저장됨"
                : draftStatus === "restored"
                  ? "임시 저장 내용을 복원했습니다"
                  : draftStatus === "error"
                    ? "임시 저장에 실패했습니다"
                    : "입력 내용을 자동으로 임시 저장합니다"}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            현재 브라우저 탭에 24시간 보관되며, 비밀번호와 인증서 원본은 저장하지 않습니다.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {onClearDraft ? (
            <Button
              type="button"
              variant="ghost"
              className="w-full sm:w-auto"
              onClick={onClearDraft}
            >
              임시 저장 삭제
            </Button>
          ) : null}
          {onSaveDraft ? (
            <Button
              type="button"
              variant="soft"
              className="w-full sm:w-auto"
              onClick={onSaveDraft}
              disabled={draftStatus === "saving"}
            >
              지금 임시 저장
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <SubmitButton pendingText="저장 중" className="w-full sm:w-auto">
          {submitLabel ?? "제휴처 추가"}
        </SubmitButton>
      </div>
    </>
  );
}
