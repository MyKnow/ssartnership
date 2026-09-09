import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import type { webpack } from "next/dist/compiled/webpack/webpack";
import { AtomicDevelopmentManifestsPlugin, atomicManifestFileSystem, isManifestOutput, shouldUseAtomicManifests } from "../scripts/webpack-atomic-manifests.mjs";

test("manifest writes are limited to explicit development output and never production", () => {
  assert.equal(shouldUseAtomicManifests(true, { SELF_HOST_ATOMIC_MANIFESTS: "1", NODE_ENV: "development" }), true);
  for (const [dev, env] of [[false, { SELF_HOST_ATOMIC_MANIFESTS: "1" }], [true, {}], [true, { SELF_HOST_ATOMIC_MANIFESTS: "1", NODE_ENV: "production" }]] as const) {
    assert.equal(shouldUseAtomicManifests(dev, env), false);
  }
  const root = path.resolve(".tmp/atomic-scope/dev");
  for (const name of ["build-manifest.json", "server/next-font-manifest.json", "server/app/page_client-reference-manifest.js", "static/development/_buildManifest.js"]) {
    assert.equal(isManifestOutput(root, path.join(root, name)), true);
  }
  for (const name of ["../build-manifest.json", "server/page.js", "server/manifest.json.tmp"]) assert.equal(isManifestOutput(root, path.join(root, name)), false);
});

test("readers see the previous complete manifest until atomic rename finishes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ssartnership-atomic-"));
  try {
    const file = path.join(root, "build-manifest.json");
    await writeFile(file, '{"old":true}');
    let releaseRename: (() => void) | undefined;
    let renameEntered: () => void = () => {};
    const entered = new Promise<void>((resolve) => { renameEntered = resolve; });
    const originalWrite = fs.writeFile;
    const backend = { ...fs, rename(from: fs.PathLike, to: fs.PathLike, callback: fs.NoParamCallback) {
      releaseRename = () => fs.rename(from, to, callback);
      renameEntered();
    } };
    const wrapped = atomicManifestFileSystem(backend, root);
    let completed = false;
    const writing = new Promise<void>((resolve, reject) => wrapped.writeFile(file, '{"new":true}', (error: Error | null) => {
      completed = true;
      if (error) reject(error); else resolve();
    }));
    await entered;
    assert.equal(completed, false);
    assert.equal(await readFile(file, "utf8"), '{"old":true}');
    assert.equal(fs.writeFile, originalWrite);
    releaseRename!();
    await writing;
    assert.equal(await readFile(file, "utf8"), '{"new":true}');
    assert.deepEqual(await readdir(root), ["build-manifest.json"]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("write and rename failures reach the caller, preserve the old file and clean only the new temporary file", async () => {
  for (const failure of ["write", "rename"]) {
    const root = await mkdtemp(path.join(os.tmpdir(), "ssartnership-atomic-error-"));
    try {
      const file = path.join(root, "build-manifest.json");
      await writeFile(file, '{"old":true}');
      const expected = Object.assign(new Error("injected failure"), { code: "EIO" });
      const backend = { ...fs,
        writeFile: ((target, data, options, callback) => {
          fs.writeFile(target, data, options, (error) => callback(error ?? (failure === "write" ? expected : null)));
        }) as typeof fs.writeFile,
        rename: ((from, to, callback) => {
          if (failure === "rename") callback(expected); else fs.rename(from, to, callback);
        }) as typeof fs.rename,
      };
      const wrapped = atomicManifestFileSystem(backend, root);
      await assert.rejects(new Promise<void>((resolve, reject) => wrapped.writeFile(file, "new", (error: Error | null) => error ? reject(error) : resolve())), (error) => error === expected);
      assert.equal(await readFile(file, "utf8"), '{"old":true}');
      assert.deepEqual(await readdir(root), ["build-manifest.json"]);
      const healthy = atomicManifestFileSystem(fs, root);
      await new Promise<void>((resolve, reject) => healthy.writeFile(file, '{"recovered":true}', (error: Error | null) => error ? reject(error) : resolve()));
      assert.equal(await readFile(file, "utf8"), '{"recovered":true}');
    } finally { await rm(root, { recursive: true, force: true }); }
  }
});

test("two compiler wrappers serialize writes to the same manifest without serializing ordinary output", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ssartnership-atomic-queue-"));
  try {
    const file = path.join(root, "build-manifest.json");
    const first = atomicManifestFileSystem(fs, root);
    const second = atomicManifestFileSystem(fs, root);
    const completed: number[] = [];
    await Promise.all([first, second].map((wrapped, index) => new Promise<void>((resolve, reject) => {
      wrapped.writeFile(file, JSON.stringify({ index }), (error: Error | null) => {
        completed.push(index); if (error) reject(error); else resolve();
      });
    })));
    assert.deepEqual(completed, [0, 1]);
    assert.deepEqual(JSON.parse(await readFile(file, "utf8")), { index: 1 });
    const chunk = path.join(root, "chunk.js");
    await new Promise<void>((resolve, reject) => first.writeFile(chunk, "chunk", { flag: "wx" }, (error: Error | null) => error ? reject(error) : resolve()));
    assert.equal(await readFile(chunk, "utf8"), "chunk");
    assert.deepEqual((await readdir(root)).sort(), ["build-manifest.json", "chunk.js"]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("actual Next config installs the helper only for explicitly enabled development compilers", () => {
  const code = "const {default: config}=await import('./next.config.ts'); const fixture=()=>({plugins:[],module:{rules:[]}}); console.log(JSON.stringify([true,false].map(dev=>config.webpack(fixture(),{dev}).plugins.map(p=>p.constructor.name))));";
  for (const enabled of ["0", "1"]) {
    const result = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", code], {
      cwd: new URL("..", import.meta.url), encoding: "utf8",
      env: { ...process.env, NODE_ENV: "development", SELF_HOST_ATOMIC_MANIFESTS: enabled },
    }));
    assert.deepEqual(result, [enabled === "1" ? ["FixtureModuleBoundaryPlugin", "AtomicDevelopmentManifestsPlugin"] : ["FixtureModuleBoundaryPlugin"], ["FixtureModuleBoundaryPlugin"]]);
  }
});

test("a failed queued publication reports failure without poisoning the next queued write", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ssartnership-atomic-recovery-"));
  try {
    const file = path.join(root, "build-manifest.json");
    let attempts = 0;
    const backend = { ...fs, rename: ((from, to, callback) => {
      if (++attempts === 1) callback(Object.assign(new Error("first rename failed"), { code: "EIO" }));
      else fs.rename(from, to, callback);
    }) as typeof fs.rename };
    const wrapped = atomicManifestFileSystem(backend, root);
    const results = await Promise.allSettled([0, 1].map((index) => new Promise<void>((resolve, reject) => {
      wrapped.writeFile(file, JSON.stringify({ index }), (error: Error | null) => error ? reject(error) : resolve());
    })));
    assert.deepEqual(results.map((result) => result.status), ["rejected", "fulfilled"]);
    assert.deepEqual(JSON.parse(await readFile(file, "utf8")), { index: 1 });
    assert.deepEqual(await readdir(root), ["build-manifest.json"]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("temporary path collisions are reported without deleting the colliding file", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ssartnership-atomic-collision-"));
  try {
    let collision = "";
    const backend = { ...fs, writeFile: ((file, _data, _options, callback) => {
      collision = String(file);
      fs.writeFile(file, "not-owned-by-this-write", { flag: "wx" }, (error) => callback(error ?? Object.assign(new Error("collision"), { code: "EEXIST" })));
    }) as typeof fs.writeFile };
    const wrapped = atomicManifestFileSystem(backend, root);
    await assert.rejects(new Promise<void>((resolve, reject) => wrapped.writeFile(path.join(root, "build-manifest.json"), "new", (error: Error | null) => error ? reject(error) : resolve())), { code: "EEXIST" });
    assert.equal(await readFile(collision, "utf8"), "not-owned-by-this-write");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("the pinned webpack compiler publishes the unchanged asset through its output filesystem extension", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ssartnership-webpack-atomic-"));
  const { webpack: compile, sources } = createRequire(import.meta.url)("next/dist/compiled/webpack/webpack");
  const file = path.join(root, "build-manifest.json");
  const payload = '{"new":true}';
  const compiler = compile({ mode: "development", devtool: false, cache: false, entry: {}, output: { path: root }, plugins: [
    new AtomicDevelopmentManifestsPlugin(root),
    { apply(compiler: webpack.Compiler) {
      compiler.hooks.thisCompilation.tap("SyntheticManifest", (compilation: webpack.Compilation) => {
        compilation.emitAsset("build-manifest.json", new sources.RawSource(payload));
      });
    } },
  ] });
  const writes: string[] = [];
  const original = compiler.outputFileSystem;
  compiler.outputFileSystem = new Proxy(original, { get(target, key) {
    if (key === "writeFile") return (...args: Parameters<typeof fs.writeFile>) => {
      writes.push(String(args[0]));
      assert.equal(fs.readFileSync(file, "utf8"), '{"old":"longer document"}');
      return Reflect.apply(target.writeFile, target, args);
    };
    return Reflect.get(target, key);
  } });
  try {
    await writeFile(file, '{"old":"longer document"}');
    await new Promise<void>((resolve, reject) => compiler.run((error: Error | null, stats: webpack.Stats) => {
      if (error) reject(error); else if (stats.hasErrors()) reject(new Error("SYNTHETIC_WEBPACK_FAILED")); else resolve();
    }));
    assert.equal(await readFile(file, "utf8"), payload);
    assert.equal(writes.length, 1);
    assert.equal(path.dirname(writes[0]), root);
    assert.match(path.basename(writes[0]), /^\.build-manifest\.json\.[a-f0-9-]+\.tmp$/u);
    assert.deepEqual(await readdir(root), ["build-manifest.json"]);
  } finally {
    await new Promise<void>((resolve, reject) => compiler.close((error: Error | null) => error ? reject(error) : resolve()));
    await rm(root, { recursive: true, force: true });
  }
});
