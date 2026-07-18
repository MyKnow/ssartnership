"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowDownTrayIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { trackProductEvent } from "@/lib/product-events";
import Button from "@/components/ui/Button";
import type { ButtonVariant } from "@/components/ui/Button";
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

  if (!isClient) {
    return null;
  }

  const installed = standalone || appInstalled;
  const InstallIcon = installed ? CheckCircleIcon : ArrowDownTrayIcon;

  const handleInstall = async () => {
    if (pending || installed) {
      return;
    }
    setPending(true);
    trackProductEvent({
      eventName: "pwa_install_click",
      targetType: "pwa",
      properties: {
        iosInstallHint,
        hasDeferredPrompt: Boolean(deferredPrompt),
      },
    });
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;
        if (result.outcome === "accepted") {
          notify("설치가 시작되었습니다.");
        } else {
          notify("설치를 취소했습니다.");
        }
        setDeferredPrompt(null);
        return;
      } finally {
        setPending(false);
      }
    }

    if (iosInstallHint) {
      notify("브라우저의 공유 버튼에서 '홈 화면에 추가'를 선택해 설치해 주세요.");
    } else {
      notify("브라우저 메뉴에서 '앱 설치' 또는 '홈 화면에 추가'를 선택해 주세요.");
    }
    setPending(false);
  };

  return (
    <Button
      variant={variant}
      onClick={() => void handleInstall()}
      disabled={installed}
      loading={pending}
      loadingText="설치 준비 중"
      className={className}
    >
      <InstallIcon className="h-5 w-5" aria-hidden="true" />
      {installed ? "앱으로 실행 중" : "앱 설치"}
    </Button>
  );
}
