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
const reviewedBracesSourceDigests = {
  "LICENSE": "35bdd8a44339719441900fb50fbefc5e2dca1ca662cbaed7a687de842c8b70f2",
  "index.js": "332ea07c7b006361aad12aa994ca75dc1db8e8382b884909e2f38f10b85c88a4",
  "lib/compile.js": "b5b1f87cbb9b845c924142c739c17a2b7dc0232d6fcc43ad20970f33553774e1",
  "lib/constants.js": "c18ac5adb57308f1ce42a28552da3a31f5d83709743ebd9a636336813a744d4b",
  "lib/expand.js": "2ea630c4dd691545d3ec98b2618eb9db11f639deea7733c41483e94c5989c682",
  "lib/parse.js": "9c49fd639fc8ccda00996643a3dcbb0277a9d3ca5ea0dd0bbe377ed6d426929c",
  "lib/stringify.js": "553a681bba4d13ef238ee1df84eefb0091179c8836ab1c402c5245778cf79696",
  "lib/utils.js": "b5a7596aa67730412b3c029ef09e84e6b67b8e445cffd35d1d295549c89066c7",
  "package.json": "9f1088ab0000e0c5c91c93642443a9cd635fd887a480d937b2117a11d1cb14eb"
};
const reviewedBracesArchiveSha256 = "424408b94ac3fbb63f942fbc49397995f4e1386d366882bea04dfa7203925b73";
const reviewedBracesIntegrity = "sha512-rqTBcBRIvFepMkTYlXQRGZVJc4uMbK2nZzIvuV7AWYYAwfMTE90V0cTGTVYhERPlQkIwLoIRZZnp3eM4l0yJLQ==";
const pinnedPlatformPackages = {
  "@esbuild/darwin-arm64":
    "sha512-TZbWkQY7kvTAXbXUT7uVACR5cMHsDiSz9z7ZKAX/RTq/WJEk3QyRr0wZpNhBDX+/0CtdqUIJlOiodQcta6tY3Q==",
  "@esbuild/darwin-x64":
    "sha512-zfdzgK9ACBNZLI/CyHTOx81SyNbM6YXn7rxSgX97VjyiPl9W1i4Ka4fgKECEoFCKGpvBj5qArWIGgQjOwkgskQ==",
  "@esbuild/linux-arm64":
    "sha512-yHs+0uc8+nvEAfAfxrWQKK5peSNzBc4PegcMO0EJ2hT71uA7vB8Ihg2e77R2P7SG5uYjPbHlLLmve4LLLRCf0g==",
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
    throw new Error("the reviewed local archiver package manifest changed.");
  }
  if (JSON.stringify(vendorDigests) !== JSON.stringify(expectedVendorDigests)) {
    throw new Error("the reviewed local archiver package contents changed.");
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
      && !(path === "devDependencies.braces" && value === "file:vendor/braces-depth-guard.tgz")
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

  if (packageJson.devDependencies?.braces !== "file:vendor/braces-depth-guard.tgz" || packageJson.overrides?.braces !== "$braces") throw new Error("reviewed braces override changed");
  const bracesEntry = packageLock.packages?.["node_modules/braces"];
  if (bracesEntry?.version !== "3.0.3-depth-guard.0" || bracesEntry?.resolved !== "file:vendor/braces-depth-guard.tgz" || bracesEntry?.integrity !== reviewedBracesIntegrity || bracesEntry?.dev !== true) throw new Error("reviewed braces identity changed");
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
      && path !== "node_modules/braces"
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
  const platformEntries = packageEntries.filter(([path]) =>
    path.startsWith("node_modules/@esbuild/"));
  for (const [path, entry] of platformEntries) {
    const packageName = path.slice("node_modules/".length);
    const leaf = packageName.slice("@esbuild/".length);
    if (
      entry?.version !== "0.28.1"
      || entry.resolved !== `https://registry.npmjs.org/${packageName}/-/${leaf}-0.28.1.tgz`
      || typeof entry.integrity !== "string"
      || !entry.integrity.startsWith("sha512-")
    ) {
      throw new Error(`esbuild platform package identity changed: ${packageName}`);
    }
  }
  for (const [packageName, integrity] of Object.entries(pinnedPlatformPackages)) {
    const entry = packageLock.packages?.[`node_modules/${packageName}`];
    if (entry?.integrity !== integrity) {
      throw new Error(`deployment esbuild binary integrity changed: ${packageName}`);
    }
  }

  const unrsResolver = packageLock.packages?.["node_modules/unrs-resolver"];
  if (unrsResolver?.version !== "1.11.1" || unrsResolver.hasInstallScript !== true) {
    throw new Error("the explicitly denied unrs-resolver script changed unexpectedly.");
  }
  const lifecycleInventory = packageEntries
    .filter(([, entry]) => entry?.hasInstallScript === true)
    .map(([path, entry]) => `${path}@${entry.version ?? "unknown"}`)
    .sort();
  const expectedLifecycleInventory = [
    "node_modules/esbuild@0.28.1",
    "node_modules/unrs-resolver@1.11.1",
  ];
  if (JSON.stringify(lifecycleInventory) !== JSON.stringify(expectedLifecycleInventory)) {
    throw new Error(
      `dependency lifecycle inventory changed: ${lifecycleInventory.join(", ")}`,
    );
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

/**
 * @param {NodeJS.ProcessEnv} [source]
 * @returns {NodeJS.ProcessEnv}
 */
export function buildControlledInstallEnvironment(source = process.env) {
  const installRoot = resolve(repositoryRoot, ".tmp/install-state");
  /** @type {NodeJS.ProcessEnv} */
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

  const bracesRoot = resolve(repositoryRoot, "vendor/braces-depth-guard");
  for (const [file, digest] of Object.entries(reviewedBracesSourceDigests)) {
    if (sha256(resolve(bracesRoot, file)) !== digest) throw new Error("reviewed braces source changed");
  }
  if (sha256(resolve(repositoryRoot, "vendor/braces-depth-guard.tgz")) !== reviewedBracesArchiveSha256) throw new Error("reviewed braces archive changed");
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
