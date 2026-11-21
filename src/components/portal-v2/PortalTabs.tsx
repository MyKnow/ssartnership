"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { PV2_FOCUS_RING_CLASS_NAME, PV2_TRANSITION_CLASS_NAME } from "./portal-v2-classes";

export type PortalTabOption<T extends string> = {
  value: T;
  label: string;
};

/**
 * 같은 화면 안의 보기 전환(ARIA tabs). 높이 40, 선택 밑줄 2px.
 * 방향키·Home·End로 이동하고 선택된 탭만 Tab 순서에 둔다. 다른 URL로 이동하는
 * 메뉴는 탭이 아니라 링크 목록으로 만든다.
 */
export default function PortalTabs<T extends string>({
  label,
  value,
  onChange,
  options,
  idPrefix,
  className,
}: {
  /** 탭 목록의 접근 가능한 이름. */
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<PortalTabOption<T>>;
  /** 탭·패널 id의 기준. 패널에는 `${idPrefix}-panel-${value}`, `aria-labelledby=${idPrefix}-tab-${value}`를 쓴다. */
  idPrefix: string;
  className?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = options.length - 1;
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % options.length
        : event.key === "ArrowLeft"
          ? (index + last) % options.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) {
      return;
    }
    event.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("flex min-w-0 gap-1 overflow-x-auto border-b border-pv2-border", className)}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${option.value}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${option.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => move(event, index)}
            className={cn(
              "-mb-px h-11 shrink-0 border-b-2 px-4 pv2-label whitespace-nowrap md:h-10",
              selected
                ? "border-pv2-blue text-pv2-blue"
                : "border-transparent text-pv2-muted hover:text-pv2-text",
              PV2_FOCUS_RING_CLASS_NAME,
              PV2_TRANSITION_CLASS_NAME,
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
