/**
 * Static files the installed app needs before any page renders. They must be
 * served as-is: a member-gate redirect would break service worker registration
 * or poison the precached offline page.
 */
export const SERVICE_WORKER_PATH = "/sw.js";
export const OFFLINE_FALLBACK_PATH = "/offline.html";
export const WEB_APP_MANIFEST_PATH = "/manifest.webmanifest";

export const PWA_SHELL_PATHS = [
  SERVICE_WORKER_PATH,
  OFFLINE_FALLBACK_PATH,
  WEB_APP_MANIFEST_PATH,
] as const;

export function isPwaShellPath(pathname: string) {
  return (PWA_SHELL_PATHS as readonly string[]).includes(pathname);
}
