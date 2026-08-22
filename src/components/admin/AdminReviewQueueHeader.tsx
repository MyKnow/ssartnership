import type { ReactNode } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import InlineMessage from "@/components/ui/InlineMessage";
import StatsRow from "@/components/ui/StatsRow";
import Surface from "@/components/ui/Surface";
import type { AdminReviewQueueFeedback } from "@/lib/admin-review-queue";

export type AdminReviewQueueMetric = {
  label: string;
  value: ReactNode;
  hint: ReactNode;
};

export default function AdminReviewQueueHeader({
  eyebrow,
  title,
  description,
  actions,
  metrics,
  feedback,
  nextAction,
  showPageHeader = true,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  metrics: AdminReviewQueueMetric[];
  feedback?: AdminReviewQueueFeedback | null;
  nextAction?: {
    title: string;
    description: string;
  };
  showPageHeader?: boolean;
}) {
  return (
    <div className="grid min-w-0 gap-5">
      {showPageHeader ? (
        <AdminPageHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
          actions={actions}
        />
      ) : null}
      {feedback ? (
        <InlineMessage
          tone={feedback.tone}
          title={feedback.title}
          description={feedback.description}
        />
      ) : null}
      <StatsRow items={metrics} minItemWidth="12rem" />
      {nextAction ? (
        <Surface level="inset" padding="md" className="grid min-w-0 gap-1">
          <p className="ui-kicker">다음 행동</p>
          <p className="text-sm font-semibold text-foreground">{nextAction.title}</p>
          <p className="ui-body text-ko-pretty">{nextAction.description}</p>
        </Surface>
      ) : null}
    </div>
  );
}
