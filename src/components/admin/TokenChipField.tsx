"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
} from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  PencilIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { cn } from "@/lib/cn";

function splitTokenValues(value: string) {
  return value
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function dedupeTokenValues(values: string[]) {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    next.push(normalized);
  }

  return next;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function moveArrayItem(values: string[], from: number, to: number) {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= values.length ||
    to > values.length
  ) {
    return values;
  }

  const next = [...values];
  const [item] = next.splice(from, 1);
  if (typeof item === "undefined") {
    return values;
  }
  next.splice(to, 0, item);
  return next;
}

function remapIndexAfterMove(index: number, from: number, to: number) {
  if (index === from) {
    return to;
  }
  if (from < to && index > from && index <= to) {
    return index - 1;
  }
  if (to < from && index >= to && index < from) {
    return index + 1;
  }
  return index;
}

export default function TokenChipField({
  name,
  initialValues,
  placeholder,
  helpText,
  emptyText = "아직 등록된 항목이 없습니다.",
  className,
}: {
  name: string;
  initialValues?: string[];
  placeholder: string;
  helpText?: string;
  emptyText?: string;
  className?: string;
}) {
  const [items, setItems] = useState<string[]>(
    () => dedupeTokenValues(initialValues ?? []),
  );
  const [draft, setDraft] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const editingInputRef = useRef<HTMLInputElement | null>(null);
  const isComposingRef = useRef(false);
  const pendingCommitRef = useRef(false);

  const serialized = useMemo(() => items.join("\n"), [items]);

  useEffect(() => {
    if (editingIndex === null) {
      return;
    }
    editingInputRef.current?.focus();
    editingInputRef.current?.select();
  }, [editingIndex]);

  const commitDraft = () => {
    pendingCommitRef.current = false;
    const nextValues = splitTokenValues(draft);
    if (nextValues.length === 0) {
      setDraft("");
      return;
    }
    setItems((prev) => dedupeTokenValues([...prev, ...nextValues]));
    setDraft("");
  };

  const commitDraftAfterComposition = () => {
    pendingCommitRef.current = false;
    if (typeof window === "undefined") {
      commitDraft();
      return;
    }
    window.requestAnimationFrame(() => {
      commitDraft();
    });
  };

  const commitEdit = (index: number, value: string) => {
    const nextValue = value.trim();
    if (!nextValue) {
      setEditingIndex(null);
      setEditingValue("");
      return;
    }

    setItems((prev) => {
      const next = [...prev];
      next[index] = nextValue;
      return dedupeTokenValues(next);
    });
    setEditingIndex(null);
    setEditingValue("");
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
    setEditingIndex((current) => {
      if (current === null) {
        return null;
      }
      if (current === index) {
        return null;
      }
      return current > index ? current - 1 : current;
    });
    if (editingIndex === index) {
      setEditingValue("");
    }
  };

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditingValue(items[index] ?? "");
  };

  const moveItem = (from: number, delta: number) => {
    const targetIndex = clamp(from + delta, 0, items.length - 1);
    setItems((prev) => {
      const nextIndex = clamp(from + delta, 0, prev.length - 1);
      if (nextIndex === from) {
        return prev;
      }
      return moveArrayItem(prev, from, nextIndex);
    });
    setEditingIndex((current) => {
      if (current === null) {
        return null;
      }
      return remapIndexAfterMove(current, from, targetIndex);
    });
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text");
    const nextValues = splitTokenValues(text);
    if (nextValues.length <= 1 && !/\n/.test(text)) {
      return;
    }
    event.preventDefault();
    setItems((prev) => dedupeTokenValues([...prev, ...nextValues]));
  };

  return (
    <div className={cn("grid gap-3", className)}>
      <input type="hidden" name={name} value={serialized} />

      {items.length > 0 ? (
        <div className="grid gap-2">
          {items.map((value, index) => (
            <div
              key={value}
              className="flex min-w-0 items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                {editingIndex === index ? (
                  <Input
                    ref={editingInputRef}
                    value={editingValue}
                    onChange={(event) => setEditingValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitEdit(index, editingValue);
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setEditingIndex(null);
                        setEditingValue("");
                      }
                    }}
                    onBlur={() => commitEdit(index, editingValue)}
                    className="h-10 rounded-full px-3 py-2"
                    aria-label="칩 수정"
                  />
                ) : (
                  <p className="truncate text-sm font-medium text-foreground">
                    {value}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => moveItem(index, -1)}
                  disabled={index === 0}
                  ariaLabel="위로 이동"
                  title="위로 이동"
                  className="h-10 w-10 min-h-10 min-w-10"
                >
                  <ArrowUpIcon className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => moveItem(index, 1)}
                  disabled={index === items.length - 1}
                  ariaLabel="아래로 이동"
                  title="아래로 이동"
                  className="h-10 w-10 min-h-10 min-w-10"
                >
                  <ArrowDownIcon className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {editingIndex === index ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="icon"
                    onClick={() => commitEdit(index, editingValue)}
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
                    onClick={() => startEditing(index)}
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
                  onClick={() => removeItem(index)}
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
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-4 text-sm text-muted-foreground">
          {emptyText}
        </div>
      )}

      <div className="grid gap-2 rounded-2xl border border-dashed border-border bg-surface px-3 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                if (event.nativeEvent.isComposing || isComposingRef.current) {
                  event.preventDefault();
                  pendingCommitRef.current = true;
                  return;
                }
                event.preventDefault();
                commitDraft();
              }
            }}
            onBlur={() => {
              if (!isComposingRef.current) {
                commitDraft();
              }
            }}
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={() => {
              isComposingRef.current = false;
              if (pendingCommitRef.current) {
                commitDraftAfterComposition();
              }
            }}
            onPaste={handlePaste}
            onFocus={() => {
              if (editingIndex !== null) {
                setEditingIndex(null);
                setEditingValue("");
              }
            }}
            placeholder={placeholder}
          />
          <Button
            type="button"
            variant="ghost"
            onClick={commitDraft}
            className="w-full sm:w-auto"
          >
            <PlusIcon className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          {helpText ?? "Enter로 칩을 추가하고 버튼을 눌러 순서를 바꿀 수 있습니다."}
        </p>
      </div>
    </div>
  );
}
