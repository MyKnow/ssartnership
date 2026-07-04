"use client";

import { cn } from "@/lib/cn";
import TokenChipComposer from "@/components/admin/token-chip-field/TokenChipComposer";
import TokenChipItems from "@/components/admin/token-chip-field/TokenChipItems";
import { useTokenChipField } from "@/components/admin/token-chip-field/useTokenChipField";

export default function TokenChipFieldContent({
  name,
  id,
  initialValues,
  placeholder,
  helpText,
  emptyText = "아직 등록된 항목이 없습니다.",
  error,
  inputRef,
  className,
}: {
  name: string;
  id?: string;
  initialValues?: string[];
  placeholder: string;
  helpText?: string;
  emptyText?: string;
  error?: string | null;
  inputRef?: (element: HTMLInputElement | null) => void;
  className?: string;
}) {
  const tokenField = useTokenChipField(initialValues);

  return (
    <div className={cn("grid gap-3", className)}>
      <input type="hidden" name={name} value={tokenField.serialized} />

      {tokenField.items.length > 0 ? (
        <TokenChipItems
          items={tokenField.items}
          editingIndex={tokenField.editingIndex}
          editingValue={tokenField.editingValue}
          editingInputRef={tokenField.editingInputRef}
          onEditingValueChange={tokenField.setEditingValue}
          onCommitEdit={tokenField.commitEdit}
          onCancelEdit={() => {
            tokenField.setEditingIndex(null);
            tokenField.setEditingValue("");
          }}
          onStartEditing={tokenField.startEditing}
          onRemoveItem={tokenField.removeItem}
          onMoveItem={tokenField.moveItem}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-surface-inset px-4 py-4 text-sm text-muted-foreground">
          {emptyText}
        </div>
      )}

      <TokenChipComposer
        id={id}
        draft={tokenField.draft}
        placeholder={placeholder}
        helpText={helpText}
        editingIndex={tokenField.editingIndex}
        ariaInvalid={Boolean(error)}
        inputRef={inputRef}
        onDraftChange={tokenField.setDraft}
        onCommitDraft={tokenField.commitDraft}
        onScheduleCommitAfterComposition={tokenField.scheduleCommitAfterComposition}
        onBlurCommitDraft={() => {
          if (!tokenField.isComposingRef.current) {
            tokenField.commitDraft();
          }
        }}
        onPaste={tokenField.handlePaste}
        onCompositionStart={tokenField.handleCompositionStart}
        onCompositionEnd={tokenField.handleCompositionEnd}
        onFocus={() => {
          if (tokenField.editingIndex !== null) {
            tokenField.setEditingIndex(null);
            tokenField.setEditingValue("");
          }
        }}
      />
      {error ? (
        <span className="text-xs font-medium leading-5 text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
