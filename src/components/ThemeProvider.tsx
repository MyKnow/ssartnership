"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import {
  DEFAULT_THEME_PREFERENCE,
  THEME_STORAGE_KEY,
} from "@/lib/theme-preference";

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextThemesProvider
      attribute="class"
      storageKey={THEME_STORAGE_KEY}
      defaultTheme={DEFAULT_THEME_PREFERENCE}
      enableSystem
    >
      {children}
    </NextThemesProvider>
  );
}
