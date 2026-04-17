import Card from "@/components/ui/Card";
import Textarea from "@/components/ui/Textarea";
import SupportTemplateActions from "@/components/support/SupportTemplateActions";
import type { SupportMailTemplate } from "@/lib/support-mail";

export default function SupportTemplateCard({
  template,
  description,
}: {
  template: SupportMailTemplate;
  description: string;
}) {
  return (
    <Card tone="elevated" padding="md" className="space-y-5">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">문의 템플릿</h2>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>

      <dl className="grid gap-3 rounded-[var(--radius-card)] border border-border/70 bg-surface-muted/70 p-4 text-sm">
        <div className="grid gap-1">
          <dt className="font-semibold text-muted-foreground">받는 사람</dt>
          <dd className="break-all text-foreground">{template.to}</dd>
        </div>
        <div className="grid gap-1">
          <dt className="font-semibold text-muted-foreground">제목</dt>
          <dd className="text-foreground">{template.subject}</dd>
        </div>
      </dl>

      <Textarea
        readOnly
        value={template.bodyLines.join("\n")}
        className="min-h-80 resize-y font-mono text-xs leading-6"
        aria-label="문의 본문 템플릿"
      />

      <SupportTemplateActions
        copyText={template.copyText}
        mailtoHref={template.mailtoHref}
      />
    </Card>
  );
}
