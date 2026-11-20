/**
 * `PortalField` 안 컨트롤에 펼치는 접근성 속성. `id`는 라벨의 `htmlFor`, 도움말
 * (`${name}-hint`)·오류(`${name}-error`) id의 기준이며, 오류가 있으면 오류를, 없고
 * 도움말이 있으면 도움말을 `aria-describedby`로 연결한다.
 */
export function portalFieldProps(
  name: string,
  { error, hasHint = false }: { error?: string; hasHint?: boolean } = {},
) {
  return {
    id: name,
    "aria-invalid": Boolean(error) || undefined,
    "aria-describedby": error ? `${name}-error` : hasHint ? `${name}-hint` : undefined,
  } as const;
}
