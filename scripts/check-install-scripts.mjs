#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const minimumNpmVersion = [11, 12, 1];
const maximumNpmMajor = 11;
const expectedEsbuildIntegrity =
  "sha512-HrJrvZv5ayxBzPfwphOoNzkzOIIlifzk0KJrGK2c8R4+LKpMtpYLQeUdjnwjWv/LZlkH2laZk+4w78pi99D4Vw==";
const expectedPolicy = {
  "esbuild@0.28.1": false,
  "unrs-resolver": false,
};
const expectedVendorPackage = {
  name: "archiver",
  version: "8.0.0-cjs-compat.0",
  private: true,
  type: "commonjs",
  main: "index.cjs",
  dependencies: {
    "archiver-core": "npm:archiver@8.0.0",
  },
  engines: {
    node: ">=24",
  },
};
const expectedVendorDigests = {
  "index.cjs": "b134f0e3fc2341c955a372e7641b192aaff2acc8a9befb4f60d0a382ba9c0323",
  "package.json": "5529d14c75bcb148726dbff0cf37a5267f125305895584d9c051b3ec317a8f18",
};
const pinnedPlatformPackages = {
  "@esbuild/darwin-arm64":
    "sha512-TZbWkQY7kvTAXbXUT7uVACR5cMHsDiSz9z7ZKAX/RTq/WJEk3QyRr0wZpNhBDX+/0CtdqUIJlOiodQcta6tY3Q==",
  "@esbuild/linux-x64":
    "sha512-u/anNYF2mmVOEDwLtnQ1wOr3EZ9sTNGLWrsYGYwHWzGA3Si84IOkHXlbWTD1NB+9/1lcnweYKO54uhxZydNzfA==",
  "@esbuild/win32-x64":
    "sha512-bm4Mowrv+GXMlpWX++EcXw/iLyd1o3+bJkC2DkWXYVvgZCqD/bSj9ctZeAMC3cIxgjRVR2Dufaiu4YPxr5gW1A==",
};
const rootInstallEvents = [
  "preinstall",
  "install",
  "postinstall",
  "prepublish",
  "preprepare",
  "prepare",
  "postprepare",
  "predependencies",
  "dependencies",
  "postdependencies",
  "preinstall:trusted",
  "postinstall:trusted",
];
const sha512SriPattern = /^sha512-[A-Za-z0-9+/]{86}==$/;

function isAtLeast(actual, minimum) {
  for (let index = 0; index < minimum.length; index += 1) {
    if ((actual[index] ?? 0) > minimum[index]) return true;
    if ((actual[index] ?? 0) < minimum[index]) return false;
  }
  return true;
}

function collectDependencySources(value, path = [], result = []) {
  if (typeof value === "string") {
    result.push({ path: path.join("."), value });
    return result;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  for (const [key, child] of Object.entries(value)) {
    collectDependencySources(child, [...path, key], result);
  }
  return result;
}

function isStringLeafObject(value) {
  if (typeof value === "string") return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every(isStringLeafObject);
}

function isReviewedRegistryDependencySpec(value, { allowOverrideReference = false } = {}) {
  const version = "[0-9]+(?:\\.[0-9]+){0,2}(?:-[0-9A-Za-z.-]+)?";
  if (new RegExp(`^[~^]?${version}$`).test(value)) return true;
  if (allowOverrideReference && /^\$[A-Za-z0-9@/_.-]+$/.test(value)) return true;
  return new RegExp(
    `^npm:(?:@[^/\\s]+/)?[^@/\\s]+@[~^]?${version}$`,
  ).test(value);
}

function packageNameFromLockPath(path, entry) {
  if (typeof entry?.name === "string" && entry.name.length > 0) {
    return entry.name;
  }
  const match = path.match(/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)$/);
  return match?.[1] ?? null;
}

function registryTarballUrl(name, version) {
  const leaf = name.includes("/") ? name.slice(name.lastIndexOf("/") + 1) : name;
  return `https://registry.npmjs.org/${name}/-/${leaf}-${version}.tgz`;
}

export function validateStaticInstallPolicy({
  packageJson,
  packageLock,
  npmConfig,
  vendorPackageJson,
  vendorDigests,
}) {
  const configLines = npmConfig
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .sort();
  const expectedConfigLines = [
    "allow-git=none",
    "ignore-scripts=true",
    "omit-lockfile-registry-resolved=false",
  ];
  if (JSON.stringify(configLines) !== JSON.stringify(expectedConfigLines)) {
    throw new Error(".npmrc install controls changed or contain an override.");
  }
  if (JSON.stringify(packageJson.allowScripts) !== JSON.stringify(expectedPolicy)) {
    throw new Error("allowScripts policy changed; every dependency lifecycle must stay denied.");
  }
  if (packageJson.workspaces !== undefined) {
    throw new Error("workspace lifecycle scripts require a new explicit install policy.");
  }
  const rootLifecycle = rootInstallEvents.filter(
    (event) => typeof packageJson.scripts?.[event] === "string",
  );
  if (rootLifecycle.length > 0) {
    throw new Error(`root install lifecycle scripts are forbidden: ${rootLifecycle.join(", ")}`);
  }

  if (packageJson.overrides?.archiver !== "file:vendor/archiver-cjs-compat") {
    throw new Error("the only reviewed local dependency source changed.");
  }
  if (JSON.stringify(vendorPackageJson) !== JSON.stringify(expectedVendorPackage)) {
    throw new Error("the reviewed local archiver manifest changed.");
  }
  if (JSON.stringify(vendorDigests) !== JSON.stringify(expectedVendorDigests)) {
    throw new Error("the reviewed local archiver contents changed.");
  }

  const dependencySections = {
    dependencies: packageJson.dependencies,
    devDependencies: packageJson.devDependencies,
    optionalDependencies: packageJson.optionalDependencies,
    peerDependencies: packageJson.peerDependencies,
    overrides: packageJson.overrides,
  };
  for (const sectionName of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ]) {
    const section = packageJson[sectionName];
    if (
      section !== undefined
      && (
        !section
        || typeof section !== "object"
        || Array.isArray(section)
        || Object.values(section).some((value) => typeof value !== "string")
      )
    ) {
      throw new Error(`${sectionName} must remain a string-valued dependency map.`);
    }
  }
  if (!isStringLeafObject(packageJson.overrides)) {
    throw new Error("overrides must remain a plain object with string leaves.");
  }
  const dependencySources = collectDependencySources(dependencySections);
  const nonRegistrySources = dependencySources.filter(({ path, value }) =>
    !(path === "overrides.archiver" && value === "file:vendor/archiver-cjs-compat")
      && !isReviewedRegistryDependencySpec(value, {
        allowOverrideReference: path.startsWith("overrides."),
      }));
  if (
    nonRegistrySources.length !== 0
    || !dependencySources.some(
      ({ path, value }) => path === "overrides.archiver"
        && value === "file:vendor/archiver-cjs-compat",
    )
  ) {
    throw new Error("an unreviewed non-registry dependency source was added.");
  }

  const packageEntries = Object.entries(packageLock.packages ?? {});
  const namedRegistryEntries = packageEntries
    .filter(([path, entry]) => path !== "" && typeof entry?.name === "string")
    .map(([path, entry]) => [path, entry.name]);
  if (JSON.stringify(namedRegistryEntries) !== JSON.stringify([
    ["node_modules/archiver-core", "archiver"],
  ])) {
    throw new Error("package-lock registry alias inventory changed.");
  }
  const linkEntries = packageEntries
    .filter(([, entry]) => entry?.link === true)
    .map(([path, entry]) => [path, entry]);
  if (JSON.stringify(linkEntries) !== JSON.stringify([
    ["node_modules/archiver", {
      resolved: "node_modules/exceljs/vendor/archiver-cjs-compat",
      link: true,
    }],
  ])) {
    throw new Error("package-lock local-link inventory changed.");
  }
  const localTargetPath = "node_modules/exceljs/vendor/archiver-cjs-compat";
  if (JSON.stringify(packageLock.packages?.[localTargetPath]) !== "{}") {
    throw new Error("the reviewed package-lock local target descriptor changed.");
  }
  const bundledEntries = packageEntries.filter(([, entry]) => entry?.inBundle === true);
  for (const [path, entry] of bundledEntries) {
    const marker = "/node_modules/";
    const markerIndex = path.lastIndexOf(marker);
    const parentPath = path.slice(0, markerIndex);
    const name = packageNameFromLockPath(path, entry);
    const parent = packageLock.packages?.[parentPath];
    if (
      markerIndex < 0
      || name === null
      || !Array.isArray(parent?.bundleDependencies)
      || !parent.bundleDependencies.includes(name)
      || typeof parent.resolved !== "string"
      || typeof parent.integrity !== "string"
    ) {
      throw new Error("package-lock bundled dependency escaped its pinned parent.");
    }
  }
  const unclassifiedEntries = packageEntries.filter(([path, entry]) =>
    path !== ""
      && path !== localTargetPath
      && entry?.link !== true
      && entry?.inBundle !== true
      && typeof entry?.version !== "string");
  if (unclassifiedEntries.length > 0) {
    throw new Error("package-lock contains an unclassified dependency entry.");
  }
  const registryEntriesWithoutIdentity = packageEntries.filter(([path, entry]) =>
    path !== ""
      && typeof entry?.version === "string"
      && entry.link !== true
      && entry.inBundle !== true
      && (
        packageNameFromLockPath(path, entry) === null
        || typeof entry.resolved !== "string"
        || entry.resolved !== registryTarballUrl(
          packageNameFromLockPath(path, entry),
          entry.version,
        )
        || typeof entry.integrity !== "string"
        || !sha512SriPattern.test(entry.integrity)
      ));
  if (registryEntriesWithoutIdentity.length > 0) {
    throw new Error(
      "every package-lock registry dependency requires an npmjs URL and SHA-512 integrity.",
    );
  }

  const esbuild = packageLock.packages?.["node_modules/esbuild"];
  if (
    esbuild?.version !== "0.28.1"
    || esbuild.hasInstallScript !== true
    || esbuild.resolved !== "https://registry.npmjs.org/esbuild/-/esbuild-0.28.1.tgz"
    || esbuild.integrity !== expectedEsbuildIntegrity
  ) {
    throw new Error(
      "esbuild must retain its exact version, registry URL, integrity, and denied lifecycle.",
    );
  }
  for (const [packageName, integrity] of Object.entries(pinnedPlatformPackages)) {
    const entry = packageLock.packages?.[`node_modules/${packageName}`];
    const leaf = packageName.slice("@esbuild/".length);
    if (
      entry?.version !== "0.28.1"
      || entry.resolved
        !== `https://registry.npmjs.org/${packageName}/-/${leaf}-0.28.1.tgz`
      || entry.integrity !== integrity
    ) {
      throw new Error(`deployment esbuild identity changed: ${packageName}`);
    }
  }

  const lifecycleInventory = packageEntries
    .filter(([, entry]) => entry?.hasInstallScript === true)
    .map(([path, entry]) => `${path}@${entry.version ?? "unknown"}`)
    .sort();
  if (JSON.stringify(lifecycleInventory) !== JSON.stringify([
    "node_modules/esbuild@0.28.1",
    "node_modules/unrs-resolver@1.11.1",
  ])) {
    throw new Error(`dependency lifecycle inventory changed: ${lifecycleInventory.join(", ")}`);
  }
}

export function validateEffectiveNpmConfig({
  npmVersionText,
  config,
  githubActions = false,
}) {
  const npmVersion = npmVersionText.split(".").map((part) => Number(part));
  if (
    npmVersion.length < 3
    || npmVersion.some((part) => !Number.isInteger(part) || part < 0)
    || !isAtLeast(npmVersion, minimumNpmVersion)
    || npmVersion[0] > maximumNpmMajor
  ) {
    throw new Error(
      `npm ${minimumNpmVersion.join(".")} through ${maximumNpmMajor}.x is required; found ${npmVersionText}.`,
    );
  }
  if (config.allowGit !== "none") {
    throw new Error("effective allow-git must be none.");
  }
  if (config.ignoreScripts !== "true") {
    throw new Error("effective ignore-scripts must be true.");
  }
  if (config.omitLockfileRegistryResolved !== "false") {
    throw new Error("effective omit-lockfile-registry-resolved must be false.");
  }
  if (githubActions && npmVersionText !== "11.16.0") {
    throw new Error(`GitHub Actions requires exact npm 11.16.0; found ${npmVersionText}.`);
  }
}

export function buildControlledInstallEnvironment(source = process.env) {
  const installRoot = resolve(repositoryRoot, ".tmp/install-state");
  const environment = {
    NPM_CONFIG_CACHE: resolve(installRoot, "cache"),
    NPM_CONFIG_GLOBALCONFIG: resolve(installRoot, "global.npmrc"),
    NPM_CONFIG_USERCONFIG: resolve(repositoryRoot, ".npmrc"),
    PATH: dirname(process.execPath),
  };
  for (const key of [
    "CI",
    "GITHUB_ACTIONS",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "LANG",
    "LC_ALL",
    "NO_COLOR",
    "NO_PROXY",
    "NODE_EXTRA_CA_CERTS",
    "RUNNER_ARCH",
    "RUNNER_OS",
    "SSL_CERT_DIR",
    "SSL_CERT_FILE",
    "SystemRoot",
    "TERM",
    "TEMP",
    "TMP",
    "TMPDIR",
    "WINDIR",
    "http_proxy",
    "https_proxy",
    "no_proxy",
  ]) {
    if (typeof source[key] === "string") environment[key] = source[key];
  }
  environment.NPM_CONFIG_AUDIT = "false";
  environment.NPM_CONFIG_ALLOW_GIT = "none";
  environment.NPM_CONFIG_FUND = "false";
  environment.NPM_CONFIG_IGNORE_SCRIPTS = "true";
  environment.NPM_CONFIG_OMIT_LOCKFILE_REGISTRY_RESOLVED = "false";
  environment.NPM_CONFIG_REGISTRY = "https://registry.npmjs.org/";
  return environment;
}

export function resolveTrustedNpmCliPath(source = process.env) {
  const requestedPath = source.npm_execpath;
  if (typeof requestedPath !== "string" || !isAbsolute(requestedPath)) {
    throw new Error("trusted installation must be launched through npm run.");
  }
  const npmCliPath = realpathSync(requestedPath);
  if (!lstatSync(npmCliPath).isFile()) {
    throw new Error("npm_execpath must resolve to a regular file.");
  }
  const npmPackagePath = resolve(dirname(npmCliPath), "..", "package.json");
  const npmPackage = JSON.parse(readFileSync(npmPackagePath, "utf8"));
  if (
    npmPackage.name !== "npm"
    || npmPackage.bin?.npm !== "bin/npm-cli.js"
    || realpathSync(resolve(dirname(npmPackagePath), npmPackage.bin.npm)) !== npmCliPath
  ) {
    throw new Error("npm_execpath is not the CLI declared by an npm package.");
  }
  return npmCliPath;
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function readNpm(args, environment, npmCliPath) {
  return execFileSync(process.execPath, [npmCliPath, ...args], {
    cwd: repositoryRoot,
    env: environment,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export function checkInstallScriptPolicy({
  environment = buildControlledInstallEnvironment(),
  npmCliPath = resolveTrustedNpmCliPath(),
} = {}) {
  mkdirSync(environment.NPM_CONFIG_CACHE, { recursive: true, mode: 0o700 });
  if (!existsSync(environment.NPM_CONFIG_GLOBALCONFIG)) {
    writeFileSync(environment.NPM_CONFIG_GLOBALCONFIG, "", {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  }
  const packageJson = JSON.parse(
    readFileSync(resolve(repositoryRoot, "package.json"), "utf8"),
  );
  const packageLock = JSON.parse(
    readFileSync(resolve(repositoryRoot, "package-lock.json"), "utf8"),
  );
  const npmConfig = readFileSync(resolve(repositoryRoot, ".npmrc"), "utf8");
  const vendorRoot = resolve(repositoryRoot, "vendor/archiver-cjs-compat");
  const vendorPackageJson = JSON.parse(
    readFileSync(resolve(vendorRoot, "package.json"), "utf8"),
  );
  const vendorDigests = {
    "index.cjs": sha256(resolve(vendorRoot, "index.cjs")),
    "package.json": sha256(resolve(vendorRoot, "package.json")),
  };
  if (JSON.stringify(readdirSync(vendorRoot).sort()) !== JSON.stringify([
    "index.cjs",
    "package.json",
  ])) {
    throw new Error("the reviewed local archiver file inventory changed.");
  }

  validateStaticInstallPolicy({
    packageJson,
    packageLock,
    npmConfig,
    vendorPackageJson,
    vendorDigests,
  });
  const npmVersionText = readNpm(["--version"], environment, npmCliPath);
  validateEffectiveNpmConfig({
    npmVersionText,
    githubActions: environment.GITHUB_ACTIONS === "true",
    config: {
      allowGit: readNpm(["config", "get", "allow-git"], environment, npmCliPath),
      ignoreScripts: readNpm(
        ["config", "get", "ignore-scripts"],
        environment,
        npmCliPath,
      ),
      omitLockfileRegistryResolved: readNpm(
        ["config", "get", "omit-lockfile-registry-resolved"],
        environment,
        npmCliPath,
      ),
    },
  });

  process.stdout.write(
    `[install-scripts] npm ${npmVersionText} will ignore every dependency lifecycle.\n`,
  );
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    checkInstallScriptPolicy();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[install-scripts] ${message}\n`);
    process.exit(1);
  }
}
