"use client";

import { useEffect, useRef } from "react";
import { recordShowcaseProjectView } from "@/app/(site)/events/project-showcase/actions";

export default function ShowcaseProjectViewRecorder({
  projectId,
  enabled,
}: {
  projectId: string;
  enabled: boolean;
}) {
  const hasRecorded = useRef(false);

  useEffect(() => {
    if (!enabled || hasRecorded.current) return;
    hasRecorded.current = true;
    void recordShowcaseProjectView(projectId).catch(() => undefined);
  }, [enabled, projectId]);

  return null;
}
