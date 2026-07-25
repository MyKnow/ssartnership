import assert from "node:assert/strict";
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
