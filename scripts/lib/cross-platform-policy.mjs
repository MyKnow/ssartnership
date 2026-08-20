import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";

const NATIVE_PACKAGE_MATRIX = [
  ["Windows x64", "node_modules/@esbuild/win32-x64"],
  ["Windows x64", "node_modules/@img/sharp-win32-x64"],
  ["macOS arm64", "node_modules/@esbuild/darwin-arm64"],
  ["macOS arm64", "node_modules/@img/sharp-darwin-arm64"],
  ["macOS arm64", "node_modules/@img/sharp-libvips-darwin-arm64"],
];

const SOURCE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".mts",
  ".js",
  ".jsx",
  ".mjs",
  ".json",
  ".css",
];

const IMPORT_PATTERN =
  /(?:\bfrom\s*|\bimport\s*\(|\brequire\s*\()\s*["']([^"']+)["']/gu;

function lineNumberForIndex(source, index) {
  return source.slice(0, index).split("\n").length;
}

export function findCaseInsensitiveCollisions(paths) {
  const groups = new Map();
  for (const filePath of paths) {
    const key = filePath.normalize("NFC").toLowerCase();
    const group = groups.get(key) || [];
    group.push(filePath);
    groups.set(key, group);
  }
  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => [...group].sort())
    .sort((left, right) => left[0].localeCompare(right[0]));
}

export function findForbiddenAbsolutePaths(sources) {
  const violations = [];
  const patterns = [
    {
      code: "posix_user_or_application_absolute_path",
      pattern: /\/(?:Users|Applications|opt\/homebrew)\//gu,
    },
    {
      code: "windows_user_absolute_path",
      pattern: /\b[A-Za-z]:[\\/]+Users[\\/]+/gu,
    },
  ];

  for (const { file, source } of sources) {
    for (const { code, pattern } of patterns) {
      pattern.lastIndex = 0;
      for (const match of source.matchAll(pattern)) {
        violations.push({
          file,
          line: lineNumberForIndex(source, match.index || 0),
          code,
        });
      }
    }
  }

  return violations;
}

export function findNonPortablePackageScripts(scripts) {
  const violations = [];
  const patterns = [
    ["shell_chaining", /(?:&&|\|\||;)/u],
    ["shell_runtime", /(?:^|\s)(?:bash|sh|zsh|cmd(?:\.exe)?|powershell|pwsh)(?:\s|$)/iu],
    ["posix_environment_assignment", /(?:^|\s)[A-Z][A-Z0-9_]*=[^\s]+\s/u],
    ["os_file_command", /(?:^|\s)(?:rm|cp|mv|touch|which|chmod|del|copy|move|where|set)(?:\s|$)/iu],
    ["executable_bit_entrypoint", /(?:^|\s)\.\/scripts\//u],
  ];

  for (const [name, command] of Object.entries(scripts)) {
    for (const [code, pattern] of patterns) {
      if (pattern.test(command)) {
        violations.push({ name, code });
        break;
      }
    }
  }

  return violations;
}

export function validateNativeDependencyMatrix(lockfile) {
  const packages = lockfile?.packages || {};
  return NATIVE_PACKAGE_MATRIX.filter(([, packagePath]) => !packages[packagePath]).map(
    ([platform, packagePath]) => ({ platform, packagePath }),
  );
}

function exactCasePathExists(root, candidatePath) {
  const relativePath = relative(root, candidatePath);
  if (!relativePath || relativePath.startsWith("..")) {
    return existsSync(candidatePath);
  }

  let current = root;
  for (const segment of relativePath.split(sep)) {
    if (!existsSync(current) || !statSync(current).isDirectory()) {
      return false;
    }
    const entries = readdirSync(current);
    if (!entries.includes(segment)) {
      return false;
    }
    current = join(current, segment);
  }
  return existsSync(current);
}

function importCandidates(basePath) {
  if (extname(basePath)) {
    return [basePath];
  }
  return [
    ...SOURCE_EXTENSIONS.map((extension) => `${basePath}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => join(basePath, `index${extension}`)),
  ];
}

export function findImportCaseViolations({ root, trackedFiles }) {
  const violations = [];
  const sourceFiles = trackedFiles.filter((file) =>
    [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs"].includes(extname(file)),
  );

  for (const relativeFile of sourceFiles) {
    const filePath = join(root, relativeFile);
    if (!existsSync(filePath)) {
      continue;
    }
    const source = readFileSync(filePath, "utf8");
    IMPORT_PATTERN.lastIndex = 0;
    for (const match of source.matchAll(IMPORT_PATTERN)) {
      const specifier = match[1];
      if (!specifier.startsWith(".") && !specifier.startsWith("@/")) {
        continue;
      }
      const basePath = specifier.startsWith("@/")
        ? resolve(root, "src", specifier.slice(2))
        : resolve(dirname(filePath), specifier);
      const candidates = importCandidates(basePath);
      if (candidates.some((candidate) => exactCasePathExists(root, candidate))) {
        continue;
      }
      if (candidates.some((candidate) => existsSync(candidate))) {
        violations.push({
          file: relativeFile,
          line: lineNumberForIndex(source, match.index || 0),
          specifier,
        });
      }
    }
  }

  return violations;
}
