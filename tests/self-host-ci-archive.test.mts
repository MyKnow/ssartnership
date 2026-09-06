import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mkdtemp, readFile, writeFile, symlink, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseHeader, sanitizeDockerArchive } from "../scripts/self-host-ci/archive.mjs";
import { copyRegularArtifact, validateLoadedImage } from "../scripts/self-host-ci/import.mjs";

function header(name: string, size: number, type = "0") {
  const value = Buffer.alloc(512);
  value.write(name, 0); value.write("0000644\0", 100); value.write("0000000\0", 108); value.write("0000000\0", 116);
  value.write(`${size.toString(8).padStart(11, "0")}\0`, 124); value.write("00000000000\0", 136);
  value.fill(32, 148, 156); value.write(type, 156); value.write("ustar\0", 257); value.write("00", 263);
  value.write(`${value.reduce((a, b) => a + b, 0).toString(8).padStart(6, "0")}\0 `, 148);
  return value;
}
test("Docker archive header rejects traversal, symlinks, hardlinks, devices and PAX overrides", () => {
  assert.equal(parseHeader(header("manifest.json", 2))?.name, "manifest.json");
  for (const name of ["../../escape", "/etc/passwd", "blobs/../../escape"]) assert.throws(() => parseHeader(header(name, 0)));
  for (const type of ["1", "2", "3", "4", "x", "g", "L"]) assert.throws(() => parseHeader(header("manifest.json", 0, type)));
  const bad = header("manifest.json", 0); bad[3] = 99; assert.throws(() => parseHeader(bad));
});
test("loaded image must preserve the approved runtime config and exact filesystem layers", () => {
  const sha = randomBytes(20).toString("hex");
  const config = { Labels: { "org.opencontainers.image.revision": sha }, User: "1001", Entrypoint: ["/app/start"], Env: ["NODE_ENV=production"] };
  const layers = [`sha256:${randomBytes(32).toString("hex")}`];
  const image = { Id: `sha256:${randomBytes(32).toString("hex")}`, Os: "linux", Architecture: "amd64", Config: config, RootFS: { Layers: layers } };
  const proof = { config, diffIds: layers };
  assert.equal(validateLoadedImage(image, proof, { sha, platform: "linux/amd64" }), image.Id);
  for (const Config of [{ ...config, User: "0" }, { ...config, Entrypoint: ["/unapproved"] }]) assert.throws(() => validateLoadedImage({ ...image, Config }, proof, { sha, platform: "linux/amd64" }));
  assert.throws(() => validateLoadedImage({ ...image, RootFS: { Layers: [] } }, proof, { sha, platform: "linux/amd64" }));
});
test("sanitizer keeps only one approved tag/config/layer closure and rejects digest tampering", { timeout: 5000 }, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ssartnership-archive-"));
  try {
    const sha = randomBytes(20).toString("hex");
    const config = Buffer.from(JSON.stringify({ os: "linux", architecture: "amd64", config: { Labels: { "org.opencontainers.image.revision": sha } } }));
    const hash = (value: Buffer) => createHash("sha256").update(value).digest("hex");
    const layer = Buffer.from("synthetic-layer");
    const configName = `blobs/sha256/${hash(config)}`; const layerName = `blobs/sha256/${hash(layer)}`;
    const tag = `ssartnership-ci/app:${sha}-amd64`;
    const manifest = Buffer.from(JSON.stringify([{ Config: configName, RepoTags: [tag], Layers: [layerName] }]));
    const entries: [string, Buffer][] = [[configName, config], [layerName, layer], ["manifest.json", manifest], ["index.json", Buffer.from('{"unapprovedTag":"discarded"}')]];
    const archive = Buffer.concat([...entries.flatMap(([name, value]) => [header(name, value.length), value, Buffer.alloc((512 - value.length % 512) % 512)]), Buffer.alloc(1024)]);
    const source = path.join(directory, "source.tar"); await writeFile(source, archive);
    const expected = { tag, id: `sha256:${hash(config)}` };
    await sanitizeDockerArchive(source, path.join(directory, "verified.tar"), expected, { sha, platform: "linux/amd64" });
    assert.ok(!(await readFile(path.join(directory, "verified.tar"))).includes(Buffer.from("unapprovedTag")));
    await assert.rejects(sanitizeDockerArchive(source, path.join(directory, "invalid.tar"), { ...expected, id: `sha256:${randomBytes(32).toString("hex")}` }, { sha, platform: "linux/amd64" }));
    await symlink(source, path.join(directory, "link.tar"));
    await assert.rejects(copyRegularArtifact(path.join(directory, "link.tar"), path.join(directory, "copy.tar"), 99999));
    await copyRegularArtifact(source, path.join(directory, "copy.tar"), 99999);
    assert.deepEqual(await readFile(path.join(directory, "copy.tar")), archive);
    await assert.rejects(copyRegularArtifact(source, path.join(directory, "oversize.tar"), 1));
  } finally { await rm(directory, { recursive: true }); }
});
