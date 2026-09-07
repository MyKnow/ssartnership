import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { createBuildEnvironmentManifest } from "./runtime-env.mjs";

const destination = process.argv[2];
if (!destination) {
  throw new Error("build environment manifest destination is required");
}

const manifest = createBuildEnvironmentManifest(process.env);
const outputPath = resolve(destination);
mkdirSync(dirname(outputPath), { recursive: true, mode: 0o755 });
writeFileSync(outputPath, `${JSON.stringify(manifest)}\n`, {
  encoding: "utf8",
  mode: 0o644,
});
