"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowDownTrayIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { trackProductEvent } from "@/lib/product-events";
import {
  buildPwaInstallGuideHref,
  getBrowserPwaInstallPlatform,
} from "@/lib/pwa-install";
import Button from "@/components/ui/Button";
import type { ButtonVariant } from "@/components/ui/Button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandaloneMode() {
  if (typeof window === "undefined") {
    return false;
  }
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function subscribeClient() {
  return () => {};
}

export default function PwaInstallButton({
  className,
  variant = "ghost",
}: {
  className?: string;
  variant?: ButtonVariant;
}) {
  const isClient = useSyncExternalStore(
    subscribeClient,
    () => true,
    () => false,
  );
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [appInstalled, setAppInstalled] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!isClient) {
      return;
    }

    const onBeforeInstallPrompt = (event: Event) => {
      if (getBrowserPwaInstallPlatform() !== "other") {
        return;
      }
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setAppInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [isClient]);

  const standalone = isClient && isStandaloneMode();

  if (!isClient) {
    return null;
  }

  const installed = standalone || appInstalled;
  const InstallIcon = installed ? CheckCircleIcon : ArrowDownTrayIcon;
  const platform = getBrowserPwaInstallPlatform();
  const guideHref = buildPwaInstallGuideHref(platform);
  const canPromptDirectly = platform === "other" && deferredPrompt !== null;

  const trackInstallClick = () => {
    trackProductEvent({
      eventName: "pwa_install_click",
      targetType: "pwa",
      properties: {
        platform,
        hasDeferredPrompt: canPromptDirectly,
      },
    });
  };

  const handleInstall = async () => {
    if (installed || pending) {
      return;
    }

    trackInstallClick();
    if (!canPromptDirectly || !deferredPrompt) {
      return;
    }

    setPending(true);
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      variant={variant}
      href={installed || canPromptDirectly ? undefined : guideHref}
      onClick={installed ? undefined : () => void handleInstall()}
      disabled={installed}
      loading={pending}
      loadingText="설치 창 여는 중"
      className={className}
    >
      <InstallIcon className="h-5 w-5" aria-hidden="true" />
      {installed ? "앱으로 실행 중" : "앱 설치"}
    </Button>
  );
}
