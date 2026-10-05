import { getBrowserPwaInstallPlatform } from "./pwa-install.ts";

export type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export const EMPTY_INSTALL_STATE = { prompt: null as InstallPrompt | null, installed: false, pending: false };

export function createPwaInstallStore(target: EventTarget, canPrompt: () => boolean) {
  let snapshot = EMPTY_INSTALL_STATE;
  let listening = false;
  const subscribers = new Set<() => void>();
  const update = (patch: Partial<typeof snapshot>) => {
    snapshot = { ...snapshot, ...patch };
    for (const subscriber of subscribers) subscriber();
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(subscriber: () => void) {
      subscribers.add(subscriber);
      if (!listening) {
        listening = true;
        target.addEventListener("beforeinstallprompt", (event) => {
          if (!canPrompt()) return;
          event.preventDefault();
          update({ prompt: event as InstallPrompt });
        });
        target.addEventListener("appinstalled", () => update({ installed: true, prompt: null }));
      }
      return () => { subscribers.delete(subscriber); };
    },
    async prompt() {
      if (!snapshot.prompt || snapshot.pending || snapshot.installed) return;
      const prompt = snapshot.prompt;
      update({ pending: true });
      try {
        await prompt.prompt();
        await prompt.userChoice;
      } finally {
        update({ pending: false, prompt: null });
      }
    },
  };
}

let browserStore: ReturnType<typeof createPwaInstallStore> | undefined;
function getBrowserStore() {
  return browserStore ??= createPwaInstallStore(window, () => getBrowserPwaInstallPlatform() === "other");
}
export const subscribePwaInstall = (subscriber: () => void) => getBrowserStore().subscribe(subscriber);
export const getPwaInstallSnapshot = () => getBrowserStore().getSnapshot();
export const getPwaInstallServerSnapshot = () => EMPTY_INSTALL_STATE;
export const promptPwaInstall = () => getBrowserStore().prompt();
