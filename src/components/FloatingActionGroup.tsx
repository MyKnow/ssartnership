"use client";

import { createContext, type ReactNode, useCallback, useContext, useState } from "react";
import { createPortal } from "react-dom";

const FloatingActionGroupContext = createContext<HTMLDivElement | null>(null);

export default function FloatingActionGroup({ children }: { children: ReactNode }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const setContainerRef = useCallback((element: HTMLDivElement | null) => {
    setContainer(element);
  }, []);

  return (
    <FloatingActionGroupContext.Provider value={container}>
      <div
        ref={setContainerRef}
        className="pointer-events-none fixed bottom-safe-bottom-5 left-1/2 z-40 flex w-[calc(100vw-2rem)] -translate-x-1/2 flex-col items-stretch gap-3 sm:w-auto sm:items-center md:left-auto md:right-6 md:translate-x-0 md:items-end"
      />
      {children}
    </FloatingActionGroupContext.Provider>
  );
}

export function FloatingAction({
  children,
  fallbackClassName,
}: {
  children: ReactNode;
  fallbackClassName?: string;
}) {
  const container = useContext(FloatingActionGroupContext);
  if (container) {
    return createPortal(children, container);
  }
  if (!fallbackClassName) {
    return children;
  }
  return <div className={fallbackClassName}>{children}</div>;
}
