import { createHash, ECDH } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";

export const REPOSITORY = "https://github.com/MyKnow/ssartnership.git";
export const SHA = /^[a-f0-9]{40}$/u;
export const HASH = /^[a-f0-9]{64}$/u;
export const COMPONENTS = ["app", "telemetry", "database"];
export function reject(code) { throw new Error(code); }
function exactKeys(object, keys) {
  if (!object || typeof object !== "object" || Array.isArray(object) || Object.keys(object).sort().join() !== [...keys].sort().join()) reject("CI_FIELDS_INVALID");
}
export function validateRequest(value, now = Date.now()) {
  const fields = ["version", "repository", "ref", "sha", "sourceHash", "platform", "siteOrigin", "supabaseOrigin", "expiresAt"];
  if (value && Object.hasOwn(value, "vapidPublicKey")) fields.push("vapidPublicKey");
  exactKeys(value, fields);
  if (Object.hasOwn(value, "vapidPublicKey")) {
    if (typeof value.vapidPublicKey !== "string" || !/^[A-Za-z0-9_-]{87}$/u.test(value.vapidPublicKey)) reject("CI_VAPID_PUBLIC_KEY_INVALID");
    const point = Buffer.from(value.vapidPublicKey, "base64url");
    if (point.length !== 65 || point[0] !== 4 || point.toString("base64url") !== value.vapidPublicKey) reject("CI_VAPID_PUBLIC_KEY_INVALID");
    try { ECDH.convertKey(point, "prime256v1"); } catch { reject("CI_VAPID_PUBLIC_KEY_INVALID"); }
  }
  if (value.version !== 1 || value.repository !== REPOSITORY || !SHA.test(value.sha) || !HASH.test(value.sourceHash)) reject("CI_SOURCE_INVALID");
  // Only a reviewed integration branch or explicitly approved typed task
  // branch. PR refs, main, arbitrary repositories and floating SHAs are absent.
  if (!/^refs\/heads\/(?:dev|(?:feat|fix|refactor|chore|ci)\/[a-z0-9][a-z0-9-]{0,100})$/u.test(value.ref)) reject("CI_REF_INVALID");
  if (!["linux/amd64", "linux/arm64"].includes(value.platform)) reject("CI_PLATFORM_INVALID");
  for (const key of ["siteOrigin", "supabaseOrigin"]) {
    let url; try { url = new URL(value[key]); } catch { reject("CI_ORIGIN_INVALID"); }
    if (url.origin !== value[key] || url.username || url.password || !(url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) reject("CI_ORIGIN_INVALID");
  }
  const expiry = Date.parse(value.expiresAt);
  if (!Number.isFinite(expiry) || expiry <= now || expiry - now > 86_400_000) reject("CI_APPROVAL_EXPIRED");
  return Object.freeze({ ...value });
}
export function imageTag(request, component) {
  if (!COMPONENTS.includes(component)) reject("CI_COMPONENT_INVALID");
  return `ssartnership-ci/${component}:${request.sha}-${request.platform.split("/")[1]}`;
}
export function assertRootlessIdentity(uid, socket, info) {
  if (uid !== 1001 || socket !== "unix:///run/user/1001/docker.sock" || !info.SecurityOptions?.some((item) => item === "name=rootless")) reject("CI_ROOTLESS_REQUIRED");
  if (info.OSType !== "linux") reject("CI_ENGINE_INVALID");
}
export async function sha256File(file) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  return digest.digest("hex");
}
export async function assertOperatorInput(file, { directory = false } = {}) {
  if (!path.isAbsolute(file) || await realpath(file) !== file) reject("CI_INPUT_PATH_INVALID");
  let current = file;
  while (true) {
    const metadata = await lstat(current);
    if (metadata.isSymbolicLink() || metadata.uid !== 0 || (metadata.mode & 0o022) !== 0) reject("CI_INPUT_NOT_OPERATOR_OWNED");
    if (current === file && (directory ? !metadata.isDirectory() : (!metadata.isFile() || metadata.size > 150 * 1024 * 1024))) reject("CI_INPUT_INVALID");
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}
export function validateGitTree(raw) {
  const entries = raw.split("\0").filter(Boolean);
  if (!entries.length) reject("CI_EMPTY_SOURCE");
  for (const entry of entries) {
    const match = /^(100644|100755) blob [a-f0-9]{40}\t(.+)$/u.exec(entry);
    if (!match || !/^[A-Za-z0-9_.@+()[\] /-]+$/u.test(match[2]) || match[2].split("/").some((part) => !part || part === ".." || part === ".git")) reject("CI_SOURCE_PATH_INVALID");
  }
  return entries.length;
}
export function validateResult(value, request) {
  exactKeys(value, ["version", "sha", "sourceHash", "platform", "requestHash", "gate", "images"]);
  if (value.version !== 1 || value.sha !== request.sha || value.sourceHash !== request.sourceHash || value.platform !== request.platform || value.gate !== "release-passed" || !HASH.test(value.requestHash)) reject("CI_RESULT_INVALID");
  if (!Array.isArray(value.images) || value.images.length !== COMPONENTS.length) reject("CI_IMAGES_INVALID");
  for (const [index, component] of COMPONENTS.entries()) {
    const item = value.images[index];
    exactKeys(item, ["component", "tag", "id", "archive", "hash"]);
    if (item.component !== component || item.tag !== imageTag(request, component) || item.archive !== `${component}.tar` || !/^sha256:[a-f0-9]{64}$/u.test(item.id) || !HASH.test(item.hash)) reject("CI_IMAGE_INVALID");
  }
  return value;
}
