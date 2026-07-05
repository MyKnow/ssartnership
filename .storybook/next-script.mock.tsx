import { useEffect } from "react";

type NextScriptMockProps = {
  id?: string;
  src?: string;
  strategy?: "afterInteractive" | "beforeInteractive" | "lazyOnload" | "worker";
  onLoad?: (event: Event) => void;
  onReady?: () => void;
  onError?: (event: Event) => void;
};

export default function NextScriptMock({
  onLoad,
  onReady,
}: NextScriptMockProps) {
  useEffect(() => {
    onLoad?.(new Event("load"));
    onReady?.();
  }, [onLoad, onReady]);

  return null;
}
