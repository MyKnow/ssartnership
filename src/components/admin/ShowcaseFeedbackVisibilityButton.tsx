"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import { setShowcaseFeedbackHidden } from "@/app/admin/(protected)/events/project-showcase/actions";

export default function ShowcaseFeedbackVisibilityButton({ feedbackId, hidden }: { feedbackId: string; hidden: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <div className="grid justify-items-start gap-2">
      <Button
        type="button"
        size="sm"
        variant={hidden ? "secondary" : "danger"}
        disabled={isPending}
        onClick={() => {
          setError("");
          startTransition(async () => {
            const result = await setShowcaseFeedbackHidden(feedbackId, !hidden);
            if (!result.ok) setError(result.message);
          });
        }}
      >
        {isPending ? "처리 중…" : hidden ? "다시 공개" : "숨기기"}
      </Button>
      {error ? <FormMessage variant="error">{error}</FormMessage> : null}
    </div>
  );
}
