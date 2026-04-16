"use client";

import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";
import {
  clampTokenIndex,
  dedupeTokenValues,
  moveTokenArrayItem,
  remapEditingIndexAfterMove,
  splitTokenValues,
} from "@/components/admin/token-chip-field/helpers";

export function useTokenChipField(initialValues?: string[]) {
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
    const targetIndex = clampTokenIndex(from + delta, 0, items.length - 1);
    setItems((prev) => {
      const nextIndex = clampTokenIndex(from + delta, 0, prev.length - 1);
      if (nextIndex === from) {
        return prev;
      }
      return moveTokenArrayItem(prev, from, nextIndex);
    });
    setEditingIndex((current) => {
      if (current === null) {
        return null;
      }
      return remapEditingIndexAfterMove(current, from, targetIndex);
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

  const scheduleCommitAfterComposition = () => {
    pendingCommitRef.current = true;
  };

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = () => {
    isComposingRef.current = false;
    if (pendingCommitRef.current) {
      commitDraftAfterComposition();
    }
  };

  return {
    items,
    draft,
    editingIndex,
    editingValue,
    editingInputRef,
    isComposingRef,
    pendingCommitRef,
    serialized,
    setDraft,
    setEditingIndex,
    setEditingValue,
    commitDraft,
    commitDraftAfterComposition,
    commitEdit,
    removeItem,
    startEditing,
    moveItem,
    handlePaste,
    scheduleCommitAfterComposition,
    handleCompositionStart,
    handleCompositionEnd,
  };
}
