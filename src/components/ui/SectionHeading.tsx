import { cn } from "@/lib/cn";

export default function SectionHeading({
  title,
  description,
  className,
  eyebrow,
  align = "left",
  size = "section",
}: {
  title: string;
  description?: string;
  className?: string;
  eyebrow?: string;
  align?: "left" | "center";
  size?: "hero" | "page" | "section";
}) {
  const titleClassName =
    size === "hero"
      ? "ui-display"
      : size === "page"
        ? "ui-page-title"
        : "ui-section-title";

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        align === "center" ? "items-center text-center" : null,
        className,
      )}
    >
      {eyebrow ? <p className="ui-kicker">{eyebrow}</p> : null}
      <h3 className={titleClassName}>{title}</h3>
      {description ? (
        <p className="ui-body max-w-3xl">{description}</p>
      ) : null}
    </div>
  );
}
