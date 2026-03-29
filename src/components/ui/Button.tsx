import Link from "next/link";
import { cn } from "@/lib/cn";

const base =
  "inline-flex min-h-12 min-w-12 cursor-pointer items-center justify-center rounded-full font-semibold leading-none transition";

const sizes = {
  sm: "h-12 px-4 text-xs",
  md: "h-12 px-5 text-sm",
  lg: "h-12 px-6 text-base",
  icon: "h-12 w-12 p-0 text-sm",
};

const variants = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  ghost: "border border-border bg-surface text-foreground hover:border-strong",
  danger: "border border-border bg-surface text-danger hover:border-strong",
};

type ButtonProps = {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
  type?: "button" | "submit" | "reset";
  href?: string;
  target?: string;
  rel?: string;
  onClick?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  title?: string;
  style?: React.CSSProperties;
  form?: string;
};

function isInternalHref(href: string) {
  return href.startsWith("/") && !href.startsWith("//");
}

function buildLinkRel(target?: string, rel?: string) {
  if (target !== "_blank") {
    return rel;
  }
  const values = new Set((rel ?? "").split(/\s+/).filter(Boolean));
  values.add("noopener");
  values.add("noreferrer");
  return Array.from(values).join(" ");
}

export default function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  type = "button",
  href,
  target,
  rel,
  onClick,
  disabled,
  ariaLabel,
  title,
  style,
  form,
}: ButtonProps) {
  const safeRel = buildLinkRel(target, rel);
  const classes = cn(
    base,
    variants[variant],
    sizes[size],
    disabled ? "cursor-not-allowed opacity-60" : null,
    className,
  );

  if (href) {
    const sharedProps = {
      className: classes,
      "aria-label": ariaLabel,
      title,
      target,
      rel: safeRel,
      "aria-disabled": disabled || undefined,
      tabIndex: disabled ? -1 : undefined,
      onClick: disabled
        ? (event: React.MouseEvent<HTMLAnchorElement>) => {
            event.preventDefault();
          }
        : undefined,
    };

    if (isInternalHref(href)) {
      return (
        <Link href={href} {...sharedProps}>
          {children}
        </Link>
      );
    }

    return (
      <a href={href} {...sharedProps}>
        {children}
      </a>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
      style={style}
      form={form}
    >
      {children}
    </button>
  );
}
