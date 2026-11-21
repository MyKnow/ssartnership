import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { PassThrough } from "node:stream";
import test from "node:test";
import ExcelJS from "exceljs";

test("ExcelJS streaming writer remains compatible with the patched archiver", async () => {
  const output = new PassThrough();
  const chunks: Buffer[] = [];
  output.on("data", (chunk: Buffer) => chunks.push(chunk));

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: output });
  workbook.addWorksheet("시트").addRow(["테스트", 1]).commit();
  await workbook.commit();

  const result = new ExcelJS.Workbook();
  await result.xlsx.load(Buffer.concat(chunks) as unknown as ExcelJS.Buffer);

  assert.equal(result.getWorksheet("시트")?.getCell("A1").value, "테스트");
  assert.equal(result.getWorksheet("시트")?.getCell("B1").value, 1);
});

test("@aws-sdk/client-s3는 exceljs→unzipper의 정적 require를 번들러가 해석하도록만 유지한다", () => {
  // exceljs's stream reader loads `unzipper`, whose `Open.s3_v3` calls
  // `require("@aws-sdk/client-s3")` inside a function body. Application code
  // never imports the SDK, but the webpack build must resolve that literal
  // require for the server XLSX routes (Next externalizes the SDK only when it
  // resolves; otherwise the build reports a missing module). It was added with
  // the unzipper override in a7c6c3af and stays while unzipper keeps the call.
  const require = createRequire(import.meta.url);
  const packageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as { dependencies?: Record<string, string> };
  const unzipperOpen = readFileSync(require.resolve("unzipper/lib/Open/index.js"), "utf8");
  const unzipperRequiresSdk = /require\(\s*["']@aws-sdk\/client-s3["']\s*\)/u.test(unzipperOpen);
  assert.equal(unzipperRequiresSdk, true, "unzipper no longer requires @aws-sdk/client-s3; re-check whether the dependency is still needed");
  assert.ok(
    packageJson.dependencies?.["@aws-sdk/client-s3"],
    "unzipper still requires @aws-sdk/client-s3; keep it so the server bundle resolves",
  );
});
