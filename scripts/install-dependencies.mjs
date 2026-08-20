#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildControlledInstallEnvironment,
  checkInstallScriptPolicy,
  resolveTrustedNpmCliPath,
} from "./check-install-scripts.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const controlledEnv = buildControlledInstallEnvironment();
const npmCliPath = resolveTrustedNpmCliPath();
const platformPackages = {
  "darwin-arm64": [
    "@esbuild/darwin-arm64",
    "bin/esbuild",
    "e2dc9a52440a2a34f09434a2f4843cb1e30f84e40dcf238976ec61ef8cd7f36a",
  ],
  "linux-x64": [
    "@esbuild/linux-x64",
    "bin/esbuild",
    "0c6588b092a2c291a72bab90659f3c9e0e25e0fe59c9ac12b4dae4d945e5548c",
  ],
  "darwin-x64": [
    "@esbuild/darwin-x64",
    "bin/esbuild",
    "dd53ccf32f9b5b3ab30d41388ef1fc8f81c44ca57ee7a32a7364a1753308d009",
  ],
  "linux-arm64": [
    "@esbuild/linux-arm64",
    "bin/esbuild",
    "51e829ba36f36be6d9aea6e329ddc4f9350302339b16aaca96a3cb97f64a8ebb",
  ],
  "win32-x64": [
    "@esbuild/win32-x64",
    "esbuild.exe",
    "ec02ee9b14ab332416fedd10614dfb80eed5304d94f67745067c011934a8c3c3",
  ],
};
const platformPackage = platformPackages[`${process.platform}-${process.arch}`];
if (!platformPackage) {
  throw new Error(`unsupported trusted esbuild platform: ${process.platform}-${process.arch}`);
}

checkInstallScriptPolicy({ environment: controlledEnv, npmCliPath });
process.stdout.write("[install-scripts] Installing with every lifecycle disabled.\n");
execFileSync(process.execPath, [
  npmCliPath,
  "ci",
  "--ignore-scripts",
  "--allow-git=none",
  "--include=dev",
  "--include=optional",
  "--no-audit",
  "--no-fund",
], {
  cwd: repositoryRoot,
  env: controlledEnv,
  stdio: "inherit",
});

const [packageName, binaryRelativePath, expectedBinarySha256] = platformPackage;
const packagePath = realpathSync(resolve(repositoryRoot, "node_modules", packageName));
const binaryPath = resolve(packagePath, binaryRelativePath);
const realBinaryPath = realpathSync(binaryPath);
if (
  lstatSync(binaryPath).isSymbolicLink()
  || !lstatSync(binaryPath).isFile()
  || (realBinaryPath !== packagePath && !realBinaryPath.startsWith(`${packagePath}${sep}`))
) {
  throw new Error("trusted esbuild binary escaped its package or is not a regular file");
}
const binarySha256 = createHash("sha256")
  .update(readFileSync(realBinaryPath))
  .digest("hex");
if (binarySha256 !== expectedBinarySha256) {
  throw new Error("trusted esbuild binary integrity mismatch");
}
const binaryVersion = execFileSync(binaryPath, ["--version"], {
  cwd: repositoryRoot,
  env: controlledEnv,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
}).trim();
if (binaryVersion !== "0.28.1") {
  throw new Error(`trusted esbuild binary version mismatch: ${binaryVersion}`);
}
execFileSync(
  process.execPath,
  [
    "--input-type=module",
    "--eval",
    "const esbuild = await import('esbuild'); if (esbuild.version !== '0.28.1') process.exit(1); esbuild.transformSync('const value = 1');",
  ],
  {
    cwd: repositoryRoot,
    env: controlledEnv,
    stdio: "inherit",
  },
);
process.stdout.write(
  "[install-scripts] Trusted dependency installation completed with zero lifecycle scripts.\n",
);
