import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { designTokenInventory } from "../scripts/design-token-policy.mjs";
import { readSource } from "./support/read-source.ts";

test("radius utilities are registered and token drift cannot exceed its reviewed budget", () => {
  const inventory = designTokenInventory(resolve(import.meta.dirname, ".."));
  assert.deepEqual(inventory.unknown, []);
  const budget = JSON.parse(readSource("tests/fixtures/design-token-budget.json"));
  for (const [key, count] of Object.entries(inventory.counts)) assert.ok(count <= budget[key], `${key}: ${count} exceeds ${budget[key]}`);
  const css = readSource("src/app/globals.css");
  for (const radius of ["control", "card", "panel", "overlay", "pill"]) assert.match(css, new RegExp(`--radius-${radius}:\\s*var\\(--shape-radius-${radius}\\)`));
});
test("status-color hotspots use semantic tokens and UI icons use heroicons", () => {
  const files = ["admin/logs/AdminLogsPanels", "partner-change-request-ui/DiffPrimitives", "admin/member-detail/AdminMemberSecurityLogExplorer", "admin/AdminMemberOperationsPanel", "push/PushSettingsCard", "push/push-settings/PreferenceToggle", "partner-card-view/PartnerCardLockState", "partner-card-form/PartnerCampusSlugField"];
  for (const file of files) assert.doesNotMatch(readSource(`src/components/${file}.tsx`), /(?:text|bg|border)-(?:amber|emerald|rose|sky)-\d/);
  assert.doesNotMatch(readSource("src/components/partner-card-form/PartnerCampusSlugField.tsx"), /(?:text|bg|border)-slate-\d/);
  for (const name of readdirSync(new URL("../src/components/ui/", import.meta.url))) if (/\.tsx$/.test(name) && !name.includes(".stories.")) assert.doesNotMatch(readSource(`src/components/ui/${name}`), /from ["'](?:lucide-react|react-icons)/);
});
test("native preview image lint exception is confined to PlainImage", () => {
  const walk = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(resolve(directory, entry.name)) : [resolve(directory, entry.name)]);
  const files = walk(resolve(import.meta.dirname, "../src")).filter((path) => /\.tsx$/.test(path));
  const offenders = files.filter((path) => readFileSync(path, "utf8").includes("no-img-element"));
  assert.deepEqual(offenders, [resolve(import.meta.dirname, "../src/components/ui/PlainImage.tsx")]);
});
