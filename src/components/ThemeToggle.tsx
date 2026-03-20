"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";

export default function ThemeToggle() {
  const { theme, setTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-9 w-20 rounded-full border border-border bg-surface" />
    );
  }

  const resolvedTheme = theme === "system" ? systemTheme : theme;

  return (
    <Button
      type="button"
      variant="ghost"
      className="px-3 py-2 text-xs"
      onClick={() =>
        setTheme(resolvedTheme === "dark" ? "light" : "dark")
      }
    >
      {resolvedTheme === "dark" ? "다크" : "라이트"}
    </Button>
  );
}
