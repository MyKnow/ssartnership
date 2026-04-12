import type { ReactNode } from "react";
import Card from "@/components/ui/Card";
import SectionHeading from "@/components/ui/SectionHeading";
import { cn } from "@/lib/cn";

export default function FormSection({
  title,
  description,
  children,
  className,
  eyebrow,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  eyebrow?: string;
}) {
  return (
    <Card tone="elevated" padding="md" className={cn("space-y-5", className)}>
      <SectionHeading
        eyebrow={eyebrow}
        title={title}
        description={description}
        size="section"
      />
      <div>{children}</div>
    </Card>
  );
}
