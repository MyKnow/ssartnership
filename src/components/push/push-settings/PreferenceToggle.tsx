import Link from "next/link";

export function PreferenceToggle({
  id,
  label,
  checked,
  disabled,
  onChange,
  actionHref,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
  actionHref?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface-inset px-4 py-3">
      <div className="min-w-0 flex items-center gap-2">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        {actionHref ? (
          <Link
            href={actionHref}
            className="inline-flex items-center rounded-full border border-border/70 bg-surface-control px-2.5 py-1 text-[11px] font-semibold leading-none text-foreground shadow-flat transition-surface-emphasis duration-200 ease-out hover:border-strong hover:bg-surface-elevated hover:text-primary hover-shadow-raised"
            aria-label={`${label} 약관 보기`}
            title="약관 보기"
          >
            약관 보기
          </Link>
        ) : null}
      </div>
      <span className="flex items-center gap-3">
        <span
          className={
            checked
              ? "min-w-10 text-right text-xs font-semibold text-emerald-600 dark:text-emerald-300"
              : "min-w-10 text-right text-xs font-semibold text-muted-foreground"
          }
        >
          {checked ? "켜짐" : "꺼짐"}
        </span>
        <label htmlFor={id} className="relative inline-flex items-center">
          <input
            id={id}
            type="checkbox"
            className="peer sr-only"
            checked={checked}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span className="h-7 w-12 rounded-full border border-border bg-slate-300 transition peer-checked:border-emerald-500 peer-checked:bg-emerald-500 peer-disabled:opacity-50 dark:bg-slate-700 dark:peer-checked:border-emerald-400 dark:peer-checked:bg-emerald-400" />
          <span className="pointer-events-none absolute left-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5 peer-disabled:opacity-70 dark:bg-slate-950" />
        </label>
      </span>
    </div>
  );
}
