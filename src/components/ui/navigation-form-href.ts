/**
 * Builds the URL a native `method="get"` form navigates to: the action's own
 * query and hash are replaced by the submitted fields, kept in field order
 * (empty values included), exactly like the browser's GET submission.
 */
export function buildGetFormHref(
  action: string,
  entries: Iterable<[string, FormDataEntryValue]>,
): string {
  const path = action.split(/[?#]/, 1)[0] || "/";
  const params = new URLSearchParams();
  for (const [name, value] of entries) {
    params.append(name, typeof value === "string" ? value : value.name);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
