import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

export function cleanOperatorEnvironment(extra = {}) {
  return { PATH: process.env.PATH, HOME: process.env.HOME, DOCKER_HOST: process.env.DOCKER_HOST, ...extra };
}
export async function runOperatorCommand(command, args, { cwd, env = {}, timeout = 300_000, input } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: cleanOperatorEnvironment(env), stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let overflow = false;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGTERM"); }, timeout);
    child.stdout.on("data", (chunk) => { if (stdout.length + chunk.length > 8 * 1024 * 1024) { overflow = true; child.kill("SIGTERM"); } else stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-64 * 1024); });
    child.once("error", () => { clearTimeout(timer); reject(new Error("DEPLOY_COMMAND_UNAVAILABLE")); });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && !timedOut && !overflow) resolve({ stdout });
      else reject(Object.assign(new Error(timedOut ? "DEPLOY_COMMAND_TIMEOUT" : "DEPLOY_COMMAND_FAILED"), { diagnostic: stderr }));
    });
    if (input !== undefined) child.stdin.end(input);
  });
}
export async function waitApplication(origin, { timeout = 90_000, fetcher = fetch } = {}) {
  const url = new URL(origin);
  if (url.origin !== origin || !["127.0.0.1", "localhost"].includes(url.hostname) || url.protocol !== "http:") throw new Error("DEPLOY_HEALTH_ORIGIN_INVALID");
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const responses = await Promise.all(["/api/health", "/auth/login"].map((route) => fetcher(`${origin}${route}`, { redirect: "error", signal: AbortSignal.timeout(2000) })));
      if (responses.every((response) => response.status === 200)) {
        await Promise.all(responses.map((response) => response.body?.cancel()));
        return;
      }
      await Promise.all(responses.map((response) => response.body?.cancel()));
    } catch { /* Bounded readiness probe, never a failed CI test retry. */ }
    await delay(1000);
  }
  throw new Error("DEPLOY_HEALTH_FAILED");
}
export async function switchApplication({ composeArgs, cwd, nextImage, previousImage = null, origin, timeout, environment = {} }, run = runOperatorCommand) {
  if (![nextImage, ...(previousImage ? [previousImage] : [])].every((id) => /^sha256:[a-f0-9]{64}$/u.test(id))) throw new Error("DEPLOY_IMMUTABLE_IMAGE_REQUIRED");
  if (!environment || typeof environment !== "object" || Array.isArray(environment)
    || Object.keys(environment).some((key) => key !== "SELF_HOST_TELEMETRY_IMAGE")
    || (environment.SELF_HOST_TELEMETRY_IMAGE !== undefined && !/^sha256:[a-f0-9]{64}$/u.test(environment.SELF_HOST_TELEMETRY_IMAGE))) {
    throw new Error("DEPLOY_ENVIRONMENT_INVALID");
  }
  const activate = async (image) => {
    const options = { cwd, env: { SELF_HOST_IMAGE: image, ...environment } };
    await run("docker", [...composeArgs, "up", "-d", "--no-deps", "--no-build", "--pull", "never", "app"], options);
    const response = await run("docker", [...composeArgs, "ps", "--quiet", "app"], options);
    const container = response.stdout.trim();
    if (!/^[a-f0-9]{64}$/u.test(container)) throw new Error("DEPLOY_CONTAINER_INVALID");
    const inspected = JSON.parse((await run("docker", ["inspect", container], options)).stdout)[0];
    if (inspected.Config.Image !== image || !inspected.State.Running) throw new Error("DEPLOY_IMAGE_MISMATCH");
    await waitApplication(origin, { timeout });
  };
  try {
    await activate(nextImage);
    return { deployed: true, image: nextImage, previousImage };
  } catch (error) {
    try {
      if (previousImage) await activate(previousImage);
    else await run("docker", [...composeArgs, "stop", "app"], { cwd, env: { SELF_HOST_IMAGE: nextImage, ...environment } });
    } catch { throw new Error("DEPLOY_ROLLBACK_FAILED"); }
    throw Object.assign(new Error(previousImage ? "DEPLOY_FAILED_ROLLED_BACK" : "DEPLOY_FAILED_STOPPED"), { cause: error });
  }
}
