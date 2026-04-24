import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const srcDir = path.join(rootDir, "src");
const extensions = ["", ".ts", ".tsx", ".mts", ".mjs", ".js"];
const indexExtensions = [".ts", ".tsx", ".mts", ".mjs", ".js"];

function isFile(candidate) {
  try {
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function findResolvableFile(basePath) {
  const candidates = [
    ...extensions.map((extension) => `${basePath}${extension}`),
    ...indexExtensions.map((extension) => path.join(basePath, `index${extension}`)),
  ];

  return candidates.find(isFile) ?? null;
}

function resolveAliasPath(specifier) {
  if (!specifier.startsWith("@/")) {
    return null;
  }

  const relativePath = specifier.slice(2);
  return findResolvableFile(path.join(srcDir, relativePath));
}

function resolveRelativePath(specifier, parentURL) {
  if (!parentURL?.startsWith("file:")) {
    return null;
  }
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
    return null;
  }

  const parentPath = fileURLToPath(parentURL);
  const basePath = path.resolve(path.dirname(parentPath), specifier);
  return findResolvableFile(basePath);
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/cache") {
    return nextResolve("next/cache.js", context);
  }

  const aliasPath = resolveAliasPath(specifier);
  if (aliasPath) {
    return {
      shortCircuit: true,
      url: pathToFileURL(aliasPath).href,
    };
  }

  const relativePath = resolveRelativePath(specifier, context.parentURL);
  if (relativePath) {
    return {
      shortCircuit: true,
      url: pathToFileURL(relativePath).href,
    };
  }

  return nextResolve(specifier, context);
}
