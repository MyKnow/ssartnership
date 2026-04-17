import type { RefObject } from "react";
import { cn } from "@/lib/cn";

export const FIELD_ERROR_CLASS_NAME = "border-danger/40 ring-2 ring-danger/15";

export function getFieldErrorClass(
  invalid: boolean,
  className?: string,
) {
  return cn(invalid ? FIELD_ERROR_CLASS_NAME : undefined, className);
}

export function focusField(
  ref?: RefObject<
    | HTMLInputElement
    | HTMLSelectElement
    | HTMLButtonElement
    | HTMLDivElement
    | HTMLTextAreaElement
    | null
  >,
) {
  ref?.current?.focus();
}
