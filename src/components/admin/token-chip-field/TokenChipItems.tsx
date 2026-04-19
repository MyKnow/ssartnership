"use client";

import type { RefObject } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  PencilIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function TokenChipItems({
  items,
  editingIndex,
  editingValue,
  editingInputRef,
  onEditingValueChange,
  onCommitEdit,
  onCancelEdit,
  onStartEditing,
  onRemoveItem,
  onMoveItem,
}: {
  items: string[];
  editingIndex: number | null;
  editingValue: string;
  editingInputRef: RefObject<HTMLInputElement | null>;
  onEditingValueChange: (value: string) => void;
  onCommitEdit: (index: number, value: string) => void;
  onCancelEdit: () => void;
  onStartEditing: (index: number) => void;
  onRemoveItem: (index: number) => void;
  onMoveItem: (index: number, delta: number) => void;
}) {
  return (
    <div className="grid gap-2">
      {items.map((value, index) => (
        <div
          key={value}
          className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-surface-inset px-3 py-3 sm:flex-row sm:items-center"
        >
          <div className="min-w-0 flex-1">
            {editingIndex === index ? (
              <Input
                ref={editingInputRef}
                value={editingValue}
                onChange={(event) => onEditingValueChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onCommitEdit(index, editingValue);
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    onCancelEdit();
                  }
                }}
                onBlur={() => onCommitEdit(index, editingValue)}
                className="h-10 rounded-full px-3 py-2"
                aria-label="칩 수정"
              />
            ) : (
              <p className="truncate text-sm font-medium text-foreground">{value}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1 sm:shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onMoveItem(index, -1)}
              disabled={index === 0}
              ariaLabel="위로 이동"
              title="위로 이동"
              className="h-10 w-10 min-h-10 min-w-10 disabled:border-border/50 disabled:bg-surface-muted/60 disabled:text-muted-foreground/50 disabled:shadow-none disabled:opacity-35"
            >
              <ArrowUpIcon className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onMoveItem(index, 1)}
              disabled={index === items.length - 1}
              ariaLabel="아래로 이동"
              title="아래로 이동"
              className="h-10 w-10 min-h-10 min-w-10 disabled:border-border/50 disabled:bg-surface-muted/60 disabled:text-muted-foreground/50 disabled:shadow-none disabled:opacity-35"
            >
              <ArrowDownIcon className="h-4 w-4" />
            </Button>
            {editingIndex === index ? (
              <Button
                type="button"
                variant="primary"
                size="icon"
                onClick={() => onCommitEdit(index, editingValue)}
                ariaLabel="수정 완료"
                title="수정 완료"
                className="h-10 w-10 min-h-10 min-w-10"
              >
                <CheckIcon className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onStartEditing(index)}
                ariaLabel="수정"
                title="수정"
                className="h-10 w-10 min-h-10 min-w-10"
              >
                <PencilIcon className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="button"
              variant="danger"
              size="icon"
              onClick={() => onRemoveItem(index)}
              ariaLabel="삭제"
              title="삭제"
              className="h-10 w-10 min-h-10 min-w-10"
            >
              <XMarkIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
