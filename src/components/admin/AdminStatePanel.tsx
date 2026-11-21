import type { ReactNode } from "react";
import PortalStatePanel from "@/components/portal-v2/PortalStatePanel";

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
  return (
    <PortalStatePanel
      kind={kind}
      title={title}
      description={description}
      action={action}
    />
  );
}
