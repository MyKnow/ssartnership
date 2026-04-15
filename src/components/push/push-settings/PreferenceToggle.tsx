export function PreferenceToggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-4 py-3">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className="flex items-center gap-3">
        <span
          className={checked
            ? "min-w-10 text-right text-xs font-semibold text-emerald-600 dark:text-emerald-300"
            : "min-w-10 text-right text-xs font-semibold text-muted-foreground"}
        >
          {checked ? "켜짐" : "꺼짐"}
        </span>
        <span className="relative inline-flex items-center">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={checked}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span className="h-7 w-12 rounded-full border border-border bg-slate-300 transition peer-checked:border-emerald-500 peer-checked:bg-emerald-500 peer-disabled:opacity-50 dark:bg-slate-700 dark:peer-checked:border-emerald-400 dark:peer-checked:bg-emerald-400" />
          <span className="pointer-events-none absolute left-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5 peer-disabled:opacity-70 dark:bg-slate-950" />
        </span>
      </span>
    </label>
  );
}
