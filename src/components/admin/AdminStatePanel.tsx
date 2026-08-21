import type { ReactNode } from "react";
import EmptyState from "@/components/ui/EmptyState";
import InlineMessage from "@/components/ui/InlineMessage";

export type AdminStatePanelKind = "empty" | "error" | "forbidden";

export default function AdminStatePanel({
  kind,
  title,
  description,
  action,
}: {
  kind: AdminStatePanelKind;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  if (kind === "error") {
    return (
      <InlineMessage
        tone="danger"
        role="alert"
        aria-live="assertive"
        title={title}
        description={description}
        action={action}
      />
    );
  }

  if (kind === "forbidden") {
    return (
      <InlineMessage
        tone="warning"
        role="status"
        aria-live="polite"
        title={title}
        description={description}
        action={action}
      />
    );
  }

  return (
    <EmptyState
      title={title}
      description={description}
      action={action}
    />
  );
}
