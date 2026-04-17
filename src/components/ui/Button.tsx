import Link from "next/link";
import { cn } from "@/lib/cn";
import Spinner from "@/components/ui/Spinner";

const base =
  "group inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 whitespace-nowrap border font-semibold leading-none transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const sizes = {
  sm: "h-10 rounded-[0.95rem] px-4 text-sm",
  md: "h-11 rounded-[1rem] px-[1.125rem] text-sm",
  lg: "h-12 rounded-[1.05rem] px-5 text-base",
  icon: "h-11 w-11 rounded-[1rem] p-0 text-sm",
};

const variants = {
  primary:
    "border-transparent bg-primary text-primary-foreground shadow-[var(--shadow-raised)] hover:-translate-y-px hover:bg-primary-emphasis hover:shadow-[var(--shadow-floating)]",
  ghost:
    "border-border bg-surface/90 text-foreground shadow-[var(--shadow-flat)] hover:-translate-y-px hover:border-strong hover:bg-surface-elevated",
  danger:
    "border-danger/20 bg-danger/10 text-danger shadow-[var(--shadow-flat)] hover:-translate-y-px hover:border-danger/35 hover:bg-danger/12",
  soft:
    "border-primary/10 bg-primary-soft text-primary shadow-[var(--shadow-flat)] hover:-translate-y-px hover:border-primary/20 hover:bg-primary-soft/90",
  secondary:
    "border-border/70 bg-surface-muted text-foreground shadow-[var(--shadow-flat)] hover:-translate-y-px hover:border-strong hover:bg-surface",
};

export type ButtonVariant = keyof typeof variants;

type ButtonProps = {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: keyof typeof sizes;
  className?: string;
  type?: "button" | "submit" | "reset";
  href?: string;
  prefetch?: boolean;
  target?: string;
  rel?: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  ariaLabel?: string;
  title?: string;
  style?: React.CSSProperties;
  form?: string;
  formAction?: React.ButtonHTMLAttributes<HTMLButtonElement>["formAction"];
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
  prefetch,
  target,
  rel,
  onClick,
  disabled,
  loading,
  loadingText,
  ariaLabel,
  title,
  style,
  form,
  formAction,
}: ButtonProps) {
  const isDisabled = Boolean(disabled || loading);
  const safeRel = buildLinkRel(target, rel);
  const classes = cn(
    base,
    variants[variant],
    sizes[size],
    isDisabled ? "cursor-not-allowed opacity-60 shadow-none hover:translate-y-0" : null,
    className,
  );
  const content = (
    <span className="inline-flex items-center gap-2">
      {loading ? <Spinner /> : null}
      {loading ? (size === "icon" ? null : (loadingText ?? children)) : children}
    </span>
  );

  if (href) {
    const handleLinkClick = onClick
      ? (event: React.MouseEvent<HTMLAnchorElement>) => {
          if (isDisabled) {
            event.preventDefault();
            return;
          }
          onClick();
        }
      : isDisabled
        ? (event: React.MouseEvent<HTMLAnchorElement>) => {
            event.preventDefault();
          }
        : undefined;

    const sharedProps = {
      className: classes,
      "aria-label": ariaLabel,
      title,
      target,
      rel: safeRel,
      "aria-disabled": isDisabled || undefined,
      tabIndex: isDisabled ? -1 : undefined,
      onClick: handleLinkClick,
    };

    if (isInternalHref(href)) {
      return (
        <Link href={href} prefetch={prefetch} {...sharedProps}>
          {content}
        </Link>
      );
    }

    return (
      <a href={href} {...sharedProps}>
        {content}
      </a>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={isDisabled}
      aria-label={ariaLabel}
      title={title}
      style={style}
      form={form}
      formAction={formAction}
      aria-busy={loading || undefined}
    >
      {content}
    </button>
  );
}
