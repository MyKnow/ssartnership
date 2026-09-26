import { randomBytes } from "node:crypto";
import { constants, closeSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** Lab-only keys never inherit a host or provider key. Warm runs copy this
 * private directory with their cache; cold runs create independent keys.
 * @param {string} root
 * @param {"real" | "fixture"} kind
 * @param {Record<string, string | undefined>} environment
 * @returns {Record<string, string>} */
export function labBuildKey(root, kind, environment = process.env) {
  if (environment.SSARTNERSHIP_BUILD_LAB_CACHE !== "1") return {};
  if (!["real", "fixture"].includes(kind)) throw new Error("BUILD_LAB_KEY_INVALID");
  for (const name of [".tmp", ".tmp/build-lab-keys"]) {
    const directory = resolve(root, name);
    try { mkdirSync(directory, { mode: 0o700 }); } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    const stat = lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("BUILD_LAB_KEY_INVALID");
  }
  const path = resolve(root, ".tmp/build-lab-keys", `${kind}.key`);
  try { writeFileSync(path, randomBytes(32).toString("base64"), { flag: "wx", mode: 0o600 }); } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || (stat.mode & 0o777) !== 0o600 || stat.size !== 44 || stat.nlink !== 1) throw new Error("BUILD_LAB_KEY_INVALID");
    const key = readFileSync(fd, "utf8");
    if (!/^[A-Za-z0-9+/]{43}=$/u.test(key) || Buffer.from(key, "base64").toString("base64") !== key) throw new Error("BUILD_LAB_KEY_INVALID");
    return { NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: key };
  } finally { closeSync(fd); }
}
