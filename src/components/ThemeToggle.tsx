"use client";

import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "@heroicons/react/24/solid";
import Button from "@/components/ui/Button";

export default function ThemeToggle() {
  const { theme, setTheme, systemTheme, resolvedTheme } = useTheme();
  const activeTheme =
    resolvedTheme ?? (theme === "system" ? systemTheme : theme) ?? "light";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setTheme(activeTheme === "dark" ? "light" : "dark")}
      ariaLabel="테마 변경"
      title="테마 변경"
    >
      <span className="block dark:hidden">
        <MoonIcon className="h-5 w-5 text-indigo-500" />
      </span>
      <span className="hidden dark:block">
        <SunIcon className="h-5 w-5 text-amber-400" />
      </span>
    </Button>
  );
}
