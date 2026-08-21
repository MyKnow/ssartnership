"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

type FieldControlProps = {
  id?: string;
  name?: string;
  "aria-describedby"?: string;
};

export default function FieldGroup({
  label,
  children,
  className,
  error,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  error?: string | null;
}) {
  const fieldId = useId();
  const labelId = `field-group-label-${fieldId}`;
  const errorId = `field-group-error-${fieldId}`;
  const childItems = Children.toArray(children);
  const controlIndex = childItems.findIndex(
    (child) =>
      isValidElement(child) &&
      typeof (child.props as FieldControlProps).name === "string",
  );
  const control =
    controlIndex >= 0
      ? (childItems[controlIndex] as ReactElement<FieldControlProps>)
      : null;
  const controlId = control?.props.id ?? `field-group-control-${fieldId}`;
  const describedBy = [control?.props["aria-describedby"], error ? errorId : null]
    .filter(Boolean)
    .join(" ");
  const labelledChildren = control
    ? childItems.map((child, index) =>
        index === controlIndex
          ? cloneElement(control, {
              id: controlId,
              "aria-describedby": describedBy || undefined,
            })
          : child,
      )
    : childItems;

  const fieldLabel = (
    <span
      id={labelId}
      className={cn(
        "text-xs font-medium",
        error ? "text-danger" : "text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
  const fieldError = error ? (
    <p id={errorId} role="alert" className="text-xs font-medium text-danger">
      {error}
    </p>
  ) : null;

  if (control) {
    return (
      <div className={cn("grid gap-1.5", className)}>
        <label htmlFor={controlId}>{fieldLabel}</label>
        {labelledChildren}
        {fieldError}
      </div>
    );
  }

  return (
    <fieldset
      className={cn("m-0 grid min-w-0 gap-1.5 border-0 p-0", className)}
      aria-labelledby={labelId}
      aria-describedby={error ? errorId : undefined}
    >
      <legend className="contents">{fieldLabel}</legend>
      {labelledChildren}
      {fieldError}
    </fieldset>
  );
}
