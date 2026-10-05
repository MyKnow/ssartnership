import { createHash } from "node:crypto";
import { matchesIfNoneMatch } from "@/lib/http-conditional";

function createEntityTag(body: string) {
  return `"${createHash("sha256").update(body).digest("base64url")}"`;
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

  if (matchesIfNoneMatch(request.headers.get("if-none-match"), entityTag)) {
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
