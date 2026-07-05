import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  systemTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
};

const defaultThemeContext: ThemeContextValue = {
  theme: "light",
  resolvedTheme: "light",
  systemTheme: "light",
  setTheme: () => undefined,
};

const ThemeContext = createContext<ThemeContextValue>(defaultThemeContext);

function resolveTheme(theme: Theme): "light" | "dark" {
  return theme === "dark" ? "dark" : "light";
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  forcedTheme,
}: {
  children: ReactNode;
  defaultTheme?: Theme;
  forcedTheme?: Theme;
}) {
  const [theme, setTheme] = useState<Theme>(forcedTheme ?? defaultTheme);
  const resolvedTheme = resolveTheme(forcedTheme ?? theme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: forcedTheme ?? theme,
      resolvedTheme,
      systemTheme: "light",
      setTheme,
    }),
    [forcedTheme, resolvedTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
