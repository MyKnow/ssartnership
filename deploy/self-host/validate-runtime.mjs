import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateSelfHostRuntimeEnvironment } from "./runtime-env.mjs";

const scriptDirectory = fileURLToPath(new URL(".", import.meta.url));
const manifestPath = resolve(
  process.env.SELF_HOST_BUILD_MANIFEST_PATH
    ?? resolve(scriptDirectory, "build-env.json"),
);

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch {
  process.stderr.write("self-host startup validation failed: build_manifest_unavailable\n");
  process.exit(1);
}

const diagnostics = validateSelfHostRuntimeEnvironment(process.env, manifest);
if (diagnostics.length > 0) {
  const summary = diagnostics
    .map(({ code, subject }) => `${code}:${subject}`)
    .join(", ");
  process.stderr.write(`self-host startup validation failed: ${summary}\n`);
  process.exit(1);
}
