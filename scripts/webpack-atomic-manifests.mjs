import { randomUUID } from "node:crypto";
import path from "node:path";

// One queue per destination across the client/server/edge compiler wrappers.
// Never mutate node:fs or alter readers/JSON parsing to conceal bad output.
const pending = new Map();
/** @param {boolean} dev @param {{NODE_ENV?: string, SELF_HOST_ATOMIC_MANIFESTS?: string}} environment */
export function shouldUseAtomicManifests(dev, environment = process.env) {
  return dev === true && environment.NODE_ENV !== "production" && environment.SELF_HOST_ATOMIC_MANIFESTS === "1";
}
export function isManifestOutput(root, file) {
  if (typeof file !== "string" || !path.isAbsolute(file)) return false;
  const relative = path.relative(root, file);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative) && /manifest\.(?:json|js)$/iu.test(path.basename(file));
}
export function atomicManifestFileSystem(original, root) {
  if (!path.isAbsolute(root) || ["writeFile", "rename", "unlink"].some((method) => typeof original?.[method] !== "function")) {
    throw new Error("ATOMIC_MANIFEST_FILESYSTEM_INVALID");
  }
  const call = (method, args) => new Promise((resolve, reject) => {
    Reflect.apply(original[method], original, [...args, (error) => error ? reject(error) : resolve()]);
  });
  async function publish(file, data, options) {
    const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`);
    try {
      await call("writeFile", [temporary, data, { ...options, flag: "wx" }]);
      await call("rename", [temporary, file]);
    } catch (error) {
      // EEXIST means we did not create the path; never delete that entry.
      if (error.code !== "EEXIST") {
        try { await call("unlink", [temporary]); }
        catch (cleanup) { if (cleanup.code !== "ENOENT") throw new AggregateError([error, cleanup], "ATOMIC_MANIFEST_CLEANUP_FAILED"); }
      }
      throw error;
    }
  }
  const writeFile = (...args) => {
    const [file, data] = args;
    if (!isManifestOutput(root, file)) return Reflect.apply(original.writeFile, original, args);
    const callback = args.at(-1);
    if (typeof callback !== "function") throw new Error("ATOMIC_MANIFEST_CALLBACK_REQUIRED");
    const provided = args.length === 4 ? args[2] : undefined;
    const options = typeof provided === "string" ? { encoding: provided } : provided ?? {};
    if (![3, 4].includes(args.length) || (options.flag !== undefined && options.flag !== "w")) {
      queueMicrotask(() => callback(new Error("ATOMIC_MANIFEST_WRITE_OPTIONS_INVALID")));
      return;
    }
    const previous = pending.get(file) ?? Promise.resolve();
    const job = previous.catch(() => {}).then(() => publish(file, data, options));
    pending.set(file, job);
    const finish = (error) => {
      if (pending.get(file) === job) pending.delete(file);
      callback(error);
    };
    job.then(() => finish(null), finish);
  };
  return new Proxy(original, {
    get(target, property) {
      if (property === "writeFile") return writeFile;
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export class AtomicDevelopmentManifestsPlugin {
  constructor(root) { this.root = root; }
  apply(compiler) {
    let installed;
    const install = () => {
      if (compiler.outputFileSystem === installed) return;
      installed = atomicManifestFileSystem(compiler.outputFileSystem, this.root);
      compiler.outputFileSystem = installed;
    };
    compiler.hooks.beforeRun.tap("AtomicDevelopmentManifests", install);
    compiler.hooks.watchRun.tap("AtomicDevelopmentManifests", install);
  }
}
