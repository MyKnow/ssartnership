import { Search } from "lucide-react";
import type { FormHTMLAttributes, ReactNode } from "react";
import { SEARCH_INPUT_ATTRIBUTES } from "@/components/ui/input-attributes";
import { cn } from "@/lib/cn";
import { PV2_CONTROL_CLASS_NAME } from "./PortalFormControls";

/**
 * 검색 필드(Figma 125:90): 왼쪽 20px 아이콘 + Body 14 입력. 라벨은 화면에 보이지
 * 않지만 스크린리더에 전달된다.
 */
export function PortalSearchField({
  name,
  label,
  className,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "id" | "type"> & {
  name: string;
  label: string;
}) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <label htmlFor={name} className="sr-only">
        {label}
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-pv2-muted"
      />
      <input
        {...SEARCH_INPUT_ATTRIBUTES}
        {...props}
        id={name}
        name={name}
        className={cn(PV2_CONTROL_CLASS_NAME, "pl-10")}
      />
    </div>
  );
}

/**
 * 검색·정렬·상태 필터를 한 줄에 둔다(모바일은 세로). 값은 URL query가 단일 기준이므로
 * 기본은 GET 폼이다. 기본 필터가 4개를 넘으면 나머지는 `AdvancedFilterDisclosure`로 접는다.
 */
export default function PortalFilterBar({
  className,
  children,
  actions,
  ...props
}: FormHTMLAttributes<HTMLFormElement> & { actions?: ReactNode }) {
  return (
    <form
      method="get"
      role="search"
      {...props}
      className={cn("flex min-w-0 flex-col gap-3 md:flex-row md:flex-wrap md:items-center", className)}
    >
      {children}
      {actions ? <div className="flex flex-wrap items-center gap-3 md:ml-auto">{actions}</div> : null}
    </form>
  );
}
