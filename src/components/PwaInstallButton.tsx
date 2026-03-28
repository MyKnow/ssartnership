"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function PwaInstallButton({
  className,
}: {
  className?: string;
}) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosInstallHint, setIosInstallHint] = useState(false);
  const { notify } = useToast();

  useEffect(() => {
    setInstalled(isStandaloneMode());
    setIosInstallHint(isIosBrowser());

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      notify("앱이 설치되었습니다.");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [notify]);

  const canShow = useMemo(() => {
    if (installed) {
      return false;
    }
    return Boolean(deferredPrompt) || iosInstallHint;
  }, [deferredPrompt, installed, iosInstallHint]);

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
