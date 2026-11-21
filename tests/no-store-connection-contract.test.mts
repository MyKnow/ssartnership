import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const srcRoot = fileURLToPath(new URL("../src", import.meta.url));

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      return listSourceFiles(path);
    }
    return /\.(?:ts|tsx)$/.test(entry) ? [path] : [];
  });
}

test("legacy unstable_noStore is not reintroduced anywhere in src", () => {
  const offenders = listSourceFiles(srcRoot)
    .filter((path) => readFileSync(path, "utf8").includes("unstable_noStore"))
    .map((path) => relative(srcRoot, path));

  // Dynamic opt-outs use a request API (cookies(), headers()) or connection().
  assert.deepEqual(offenders, []);
});

test("member session readers stay dynamic through cookies() without noStore", () => {
  const source = readFileSync(
    new URL("../src/lib/user-auth.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /async function getRawSignedUserSession\(\) \{\s*const store = await cookies\(\);/,
  );
  assert.match(
    source,
    /export const getUserSession = cache\(async \(\) => \{\s*const session = \(await getSignedUserSession\(\)\)/,
  );
});

test("Apple Wallet pass handlers wait for a real request with connection()", () => {
  const source = readFileSync(
    new URL("../src/app/api/wallet/apple/pass/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /import \{ connection, NextRequest, NextResponse \} from "next\/server"/);
  assert.match(
    source,
    /async function requireSignedUserId\(\) \{[\s\S]*?await connection\(\);[\s\S]*?getSignedUserSession\(\)/,
  );
});
