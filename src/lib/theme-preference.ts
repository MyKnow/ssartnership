/**
 * 루트 `ThemeProvider`(next-themes)와 `global-error`가 함께 쓰는 테마 설정이다.
 * `global-error`는 ThemeProvider 밖에서 자체 문서를 렌더하므로, 같은 저장 키·기본값으로
 * 사용자가 고른 테마를 해석해야 다른 화면과 같은 테마로 보인다.
 */
export const THEME_STORAGE_KEY = "theme";
export const DEFAULT_THEME_PREFERENCE = "light";

export type ResolvedTheme = "light" | "dark";

/**
 * 이 앱의 next-themes 설정(`enableSystem`, `defaultTheme="light"`)과 같은 규칙으로
 * 저장값을 해석한다. 값이 없으면 기본 테마, `system`은 OS 색상 모드를 따르고,
 * 알 수 없는 값은 `.dark` 클래스가 붙지 않는 next-themes와 같게 라이트로 본다.
 */
export function resolveThemePreference(
  storedPreference: string | null | undefined,
  prefersDarkColorScheme: boolean,
): ResolvedTheme {
  const preference = storedPreference || DEFAULT_THEME_PREFERENCE;
  if (preference === "system") {
    return prefersDarkColorScheme ? "dark" : "light";
  }
  return preference === "dark" ? "dark" : "light";
}
