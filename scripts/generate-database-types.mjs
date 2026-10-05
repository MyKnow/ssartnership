import { spawnSync } from "node:child_process";
import { writeFileSync, renameSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

// Run against an operator-started local database. Never link, migrate or contact Production.
const result = spawnSync("supabase", ["gen", "types", "typescript", "--local", "--schema", "public"], {
  encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
});
if (result.error || result.status !== 0 || !result.stdout?.includes("export type Database")) {
  process.stderr.write("로컬 Supabase CLI와 검증할 스키마가 필요합니다. 데이터베이스 타입 생성에 실패했습니다.\n");
  process.exit(1);
}
const target = resolve("src/lib/supabase/database.generated.ts");
const temporary = `${target}.tmp`;
try {
  writeFileSync(temporary, result.stdout, { flag: "wx" });
  renameSync(temporary, target);
} finally { try { unlinkSync(temporary); } catch (error) { if (error.code !== "ENOENT") throw error; } }
