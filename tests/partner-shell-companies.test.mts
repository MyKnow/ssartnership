import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadPartnerShellCompanies } from "../src/lib/partner-shell-companies.ts";

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("company summaries load normally without a notice", async () => {
  const requested: string[][] = [];
  const result = await loadPartnerShellCompanies(["company-1"], async (ids) => {
    requested.push(ids);
    return [{ id: "company-1" }];
  });
  assert.deepEqual(result, { companies: [{ id: "company-1" }], unavailable: false });
  assert.deepEqual(requested, [["company-1"]]);
});

test("a failed summary read is unavailable and logged, never 'no companies'", async (t) => {
  const lines: string[] = [];
  t.mock.method(console, "error", (line: unknown) => { lines.push(String(line)); });
  const result = await loadPartnerShellCompanies(["company-1", "company-2"], async () => {
    throw Object.assign(new Error("connection refused"), { code: "PGRST001" });
  });
  assert.deepEqual(result, { companies: [], unavailable: true });
  assert.equal(lines.length, 1);
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.event, "[partner-layout] company summaries unavailable");
  assert.equal(entry.error.code, "PGRST001");
  assert.deepEqual(entry.properties, { companyCount: 2 });
});

test("the partner shell shows an inline notice in both layouts when summaries fail", () => {
  const layout = read("src/app/partner/layout.tsx");
  assert.match(layout, /loadPartnerShellCompanies\(\s*session\.companyIds,\s*getPartnerPortalCompanySummaries,\s*\)/u);
  assert.match(layout, /companiesUnavailable=\{companiesUnavailable\}/u);
  assert.doesNotMatch(layout, /\.catch\(\(\) => \[\]\)/u);

  const shell = read("src/components/partner/PartnerPortalShellView.tsx");
  assert.match(shell, /"회사 정보를 잠시 불러오지 못했습니다\. 잠시 후 새로고침해 주세요\."/u);
  assert.match(shell, /session && companiesUnavailable \? <CompaniesUnavailableNotice \/> : null/u);
  assert.equal(shell.match(/\{companiesNotice\}/gu)?.length, 2);
});
