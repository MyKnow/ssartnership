import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
import { reject } from "./lib.mjs";

const MAX_SIZE = 3 * 1024 ** 3;
const text = (buffer) => buffer.toString("utf8").split("\0", 1)[0];
const octal = (buffer) => {
  const value = text(buffer).trim();
  if (!/^[0-7]+$/u.test(value)) reject("CI_TAR_NUMBER_INVALID");
  return Number.parseInt(value, 8);
};
async function readExactly(handle, count, offset) {
  const buffer = Buffer.alloc(count);
  let done = 0;
  while (done < count) {
    const { bytesRead } = await handle.read(buffer, done, count - done, offset + done);
    if (!bytesRead) reject("CI_TAR_TRUNCATED");
    done += bytesRead;
  }
  return buffer;
}
export function parseHeader(header) {
  if (header.length !== 512) reject("CI_TAR_HEADER_INVALID");
  if (header.every((value) => value === 0)) return null;
  const checksum = octal(header.subarray(148, 156));
  const actual = header.reduce((sum, value, index) => sum + (index >= 148 && index < 156 ? 32 : value), 0);
  if (checksum !== actual) reject("CI_TAR_CHECKSUM_INVALID");
  const prefix = text(header.subarray(345, 500));
  const name = text(header.subarray(0, 100));
  const type = String.fromCharCode(header[156]);
  if (prefix || !["0", "\0", "5"].includes(type)) reject("CI_TAR_TYPE_INVALID");
  // Docker's `save` output may include this legacy tag index even when the
  // archive is OCI-backed. It is intentionally validated only as an allowed
  // ignored entry; the selected manifest/config/layer closure below remains
  // the sole content written to the sanitized archive.
  const allowedFile = /^(?:manifest\.json|index\.json|oci-layout|repositories|blobs\/sha256\/[a-f0-9]{64}|[a-f0-9]{64}\.json|[a-f0-9]{64}\/(?:layer\.tar|json|VERSION))$/u;
  const allowedDirectory = /^(?:blobs\/|blobs\/sha256\/|[a-f0-9]{64}\/)$/u;
  if (!(type === "5" ? allowedDirectory : allowedFile).test(name)) reject("CI_TAR_PATH_INVALID");
  const size = octal(header.subarray(124, 136));
  if (size > MAX_SIZE || (type === "5" && size !== 0)) reject("CI_TAR_SIZE_INVALID");
  return { name, size, directory: type === "5" };
}

// Do not extract an untrusted Docker tar onto the host, or load its OCI index:
// it can name additional images/tags beyond manifest.json. Inspect all regular
// entries, then copy only the one approved legacy manifest/config/layer closure
// into a new tar. No symlinks, hardlinks, devices, traversal or PAX overrides.
export async function sanitizeDockerArchive(source, destination, expected, request) {
  const input = await open(source, "r");
  let output;
  try {
    const metadata = await input.stat();
    if (!metadata.isFile() || metadata.size > MAX_SIZE || metadata.size % 512) reject("CI_TAR_SIZE_INVALID");
    const entries = new Map();
    let offset = 0;
    let ended = false;
    while (offset + 512 <= metadata.size) {
      const header = await readExactly(input, 512, offset);
      const item = parseHeader(header);
      if (!item) { ended = true; break; }
      if (entries.size >= 2048 || entries.has(item.name)) reject("CI_TAR_DUPLICATE_OR_EXCESSIVE");
      item.offset = offset;
      item.header = header;
      if (offset + 512 + item.size > metadata.size) reject("CI_TAR_TRUNCATED");
      entries.set(item.name, item);
      const blobHash = /^blobs\/sha256\/([a-f0-9]{64})$/u.exec(item.name)?.[1];
      if (blobHash) {
        const hash = createHash("sha256");
        for (let read = 0; read < item.size; read += 1024 ** 2) hash.update(await readExactly(input, Math.min(1024 ** 2, item.size - read), offset + 512 + read));
        if (hash.digest("hex") !== blobHash) reject("CI_BLOB_HASH_MISMATCH");
      }
      offset += 512 + Math.ceil(item.size / 512) * 512;
    }
    if (!ended) reject("CI_TAR_END_MISSING");
    const json = async (name) => {
      const item = entries.get(name);
      if (!item || item.directory || item.size > 256 * 1024) reject("CI_IMAGE_METADATA_INVALID");
      return JSON.parse((await readExactly(input, item.size, item.offset + 512)).toString("utf8"));
    };
    const manifests = await json("manifest.json");
    if (!Array.isArray(manifests) || manifests.length !== 1) reject("CI_ARCHIVE_IMAGE_COUNT_INVALID");
    const manifest = manifests[0];
    if (JSON.stringify(manifest.RepoTags) !== JSON.stringify([expected.tag]) || !Array.isArray(manifest.Layers) || !manifest.Layers.length || manifest.Layers.length > 128) reject("CI_ARCHIVE_TAG_INVALID");
    const configEntry = entries.get(manifest.Config);
    if (!configEntry || configEntry.size > 256 * 1024) reject("CI_IMAGE_CONFIG_INVALID");
    const configBytes = await readExactly(input, configEntry.size, configEntry.offset + 512);
    const configDigest = `sha256:${createHash("sha256").update(configBytes).digest("hex")}`;
    // Classic Docker uses the config digest as image ID; containerd-backed
    // Docker uses the manifest/index digest. Prove that index's unique native
    // image resolves to this same config and layer list, not an attestation.
    if (expected.id !== configDigest) {
      let digest = expected.id;
      let matched = false;
      for (let depth = 0; depth < 3; depth += 1) {
        if (!/^sha256:[a-f0-9]{64}$/u.test(digest)) reject("CI_DESCRIPTOR_INVALID");
        const descriptor = await json(`blobs/sha256/${digest.slice(7)}`);
        if (descriptor.config) {
          const layers = manifest.Layers.map((name) => /^blobs\/sha256\/([a-f0-9]{64})$/u.exec(name)?.[1]).map((hash) => `sha256:${hash}`);
          if (descriptor.config.digest !== configDigest || JSON.stringify(descriptor.layers?.map((item) => item.digest)) !== JSON.stringify(layers)) reject("CI_DESCRIPTOR_CLOSURE_INVALID");
          matched = true; break;
        }
        const native = descriptor.manifests?.filter((item) => `${item.platform?.os}/${item.platform?.architecture}` === request.platform);
        if (native?.length !== 1) reject("CI_DESCRIPTOR_PLATFORM_AMBIGUOUS");
        digest = native[0].digest;
      }
      if (!matched) reject("CI_CONFIG_DIGEST_MISMATCH");
    }
    const config = JSON.parse(configBytes.toString("utf8"));
    if (`${config.os}/${config.architecture}` !== request.platform || config.config?.Labels?.["org.opencontainers.image.revision"] !== request.sha) reject("CI_ARCHIVE_IDENTITY_INVALID");
    const selected = ["manifest.json", manifest.Config, ...manifest.Layers];
    if (new Set(selected).size !== selected.length || selected.some((name) => !entries.has(name) || entries.get(name).directory)) reject("CI_ARCHIVE_CLOSURE_INVALID");
    output = await open(destination, "wx", 0o600);
    for (const name of selected) {
      const item = entries.get(name);
      await output.writeFile(item.header);
      const padded = Math.ceil(item.size / 512) * 512;
      for (let read = 0; read < padded; read += 1024 ** 2) await output.writeFile(await readExactly(input, Math.min(1024 ** 2, padded - read), item.offset + 512 + read));
    }
    await output.writeFile(Buffer.alloc(1024));
    await output.sync();
    return { tag: expected.tag, id: expected.id, configDigest, config: config.config, diffIds: config.rootfs?.diff_ids, entries: selected.length };
  } finally { await input.close(); await output?.close(); }
}
