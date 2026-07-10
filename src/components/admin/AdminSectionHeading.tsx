import { cn } from "@/lib/cn";

export default function AdminSectionHeading({
  title,
  description,
  eyebrow,
  level = 2,
  className,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  level?: 2 | 3;
  className?: string;
}) {
  const Heading = level === 2 ? "h2" : "h3";

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      {eyebrow ? <p className="ui-kicker">{eyebrow}</p> : null}
      <Heading className="ui-section-title text-ko-title">{title}</Heading>
      {description ? (
        <p className="ui-body text-ko-pretty max-w-3xl">{description}</p>
      ) : null}
    </div>
  );
}
