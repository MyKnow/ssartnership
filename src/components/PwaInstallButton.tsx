"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

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

function isIosBrowser() {
  if (typeof navigator === "undefined") {
    return false;
  }
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua);
}

function subscribeClient() {
  return () => {};
}

export default function PwaInstallButton({
  className,
}: {
  className?: string;
}) {
  const isClient = useSyncExternalStore(
    subscribeClient,
    () => true,
    () => false,
  );
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [appInstalled, setAppInstalled] = useState(false);
  const { notify } = useToast();

  useEffect(() => {
    if (!isClient) {
      return;
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setAppInstalled(true);
      setDeferredPrompt(null);
      notify("앱이 설치되었습니다.");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [isClient, notify]);

  const iosInstallHint = isClient && isIosBrowser();
  const standalone = isClient && isStandaloneMode();

  const canShow = useMemo(() => {
    if (!isClient || standalone || appInstalled) {
      return false;
    }
    return Boolean(deferredPrompt) || iosInstallHint;
  }, [appInstalled, deferredPrompt, iosInstallHint, isClient, standalone]);

  if (!canShow) {
    return null;
  }

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === "accepted") {
        notify("설치가 시작되었습니다.");
      } else {
        notify("설치를 취소했습니다.");
      }
      setDeferredPrompt(null);
      return;
    }

    if (iosInstallHint) {
      notify("Safari 공유 버튼에서 '홈 화면에 추가'를 선택해 설치해 주세요.");
    }
  };

  return (
    <Button variant="ghost" onClick={() => void handleInstall()} className={className}>
      앱 설치
    </Button>
  );
}
