import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const reviewActionsSourceUrl = new URL(
  "../src/app/admin/(protected)/_actions/review-actions.ts",
  import.meta.url,
);

test("review actions reject protocol-relative return destinations through the shared sanitizer", async () => {
  const [{ sanitizeReturnTo }, source] = await Promise.all([
    import(new URL("../src/lib/return-to.ts", import.meta.url).href),
    readFile(reviewActionsSourceUrl, "utf8"),
  ]);

  assert.equal(
    sanitizeReturnTo("//evil.example/admin/reviews", "/admin/reviews"),
    "/admin/reviews",
  );
  assert.match(source, /import \{ sanitizeReturnTo \} from "@\/lib\/return-to";/);
  assert.match(source, /sanitizeReturnTo\(/);
  assert.doesNotMatch(source, /candidate\.startsWith\("\/"\)/);
});
