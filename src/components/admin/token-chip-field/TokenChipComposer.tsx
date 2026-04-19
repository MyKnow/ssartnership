"use client";

import type { ClipboardEventHandler } from "react";
import { PlusIcon } from "@heroicons/react/24/outline";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function TokenChipComposer({
  draft,
  placeholder,
  helpText,
  editingIndex,
  onDraftChange,
  onCommitDraft,
  onScheduleCommitAfterComposition,
  onBlurCommitDraft,
  onPaste,
  onCompositionStart,
  onCompositionEnd,
  onFocus,
}: {
  draft: string;
  placeholder: string;
  helpText?: string;
  editingIndex: number | null;
  onDraftChange: (value: string) => void;
  onCommitDraft: () => void;
  onScheduleCommitAfterComposition: () => void;
  onBlurCommitDraft: () => void;
  onPaste: ClipboardEventHandler<HTMLInputElement>;
  onCompositionStart: () => void;
  onCompositionEnd: () => void;
  onFocus: () => void;
}) {
  return (
    <div className="grid gap-2 rounded-2xl border border-dashed border-border bg-surface px-3 py-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <Input
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              if (event.nativeEvent.isComposing) {
                event.preventDefault();
                onScheduleCommitAfterComposition();
                return;
              }
              event.preventDefault();
              onCommitDraft();
            }
          }}
          onBlur={onBlurCommitDraft}
          onCompositionStart={onCompositionStart}
          onCompositionEnd={onCompositionEnd}
          onPaste={onPaste}
          onFocus={onFocus}
          placeholder={placeholder}
        />
        <Button
          type="button"
          variant="ghost"
          onClick={onCommitDraft}
          className="w-auto justify-self-end"
        >
          <PlusIcon className="h-4 w-4" />
          추가
        </Button>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        {helpText ?? "Enter로 칩을 추가하고 버튼을 눌러 순서를 바꿀 수 있습니다."}
      </p>
      {editingIndex !== null ? (
        <p className="text-xs text-muted-foreground">편집 중에는 입력창 포커스가 해제됩니다.</p>
      ) : null}
    </div>
  );
}
