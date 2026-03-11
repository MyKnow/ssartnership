import type { CategoryKey } from "@/lib/types";

export type CategoryTabOption = {
  key: CategoryKey | "all";
  label: string;
  description?: string;
};

export default function CategoryTabs({
  options,
  activeKey,
  onChange,
}: {
  options: CategoryTabOption[];
  activeKey: CategoryKey | "all";
  onChange: (key: CategoryKey | "all") => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isActive = option.key === activeKey;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={`flex flex-col gap-1 rounded-2xl border px-4 py-3 text-left transition ${
              isActive
                ? "border-slate-900 bg-slate-900 text-white dark:border-white/80 dark:bg-white dark:text-slate-900"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            }`}
          >
            <span className="text-sm font-semibold">{option.label}</span>
            {option.description ? (
              <span
                className={`text-xs ${
                  isActive
                    ? "text-slate-200 dark:text-slate-600"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {option.description}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
