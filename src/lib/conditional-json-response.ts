import { createHash } from "node:crypto";

function createEntityTag(body: string) {
  return `"${createHash("sha256").update(body).digest("base64url")}"`;
}

function matchesEntityTag(request: Request, entityTag: string) {
  return (request.headers.get("if-none-match") ?? "")
    .split(",")
    .map((value) => value.trim())
    .some((value) => value === entityTag || value === "*");
}

/**
 * Returns a user-private JSON response that can be conditionally revalidated.
 * The caller must authenticate and authorize before creating the response.
 */
export function conditionalJsonResponse(
  request: Request,
  payload: unknown,
  init: ResponseInit = {},
) {
  const body = JSON.stringify(payload);
  const entityTag = createEntityTag(body);
  const headers = new Headers(init.headers);

  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "private, no-cache");
  headers.set("Vary", "Cookie");
  headers.set("ETag", entityTag);

  if (matchesEntityTag(request, entityTag)) {
    headers.delete("Content-Type");
    return new Response(null, {
      ...init,
      status: 304,
      headers,
    });
  }

  return new Response(body, {
    ...init,
    headers,
  });
}
