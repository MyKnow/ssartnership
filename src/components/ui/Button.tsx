import Link from "next/link";
import { cn } from "@/lib/cn";
import Spinner from "@/components/ui/Spinner";

const base =
  "group inline-flex min-h-11 min-w-11 items-center justify-center gap-2 whitespace-nowrap border font-semibold leading-none transition-interactive duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const sizes = {
  sm: "h-10 rounded-[0.95rem] px-4 text-sm",
  md: "h-11 rounded-[1rem] px-[1.125rem] text-sm",
  lg: "h-12 rounded-[1.05rem] px-5 text-base",
  icon: "h-11 w-11 rounded-[1rem] p-0 text-sm",
};

const variants = {
  primary: {
    enabled:
      "border-transparent bg-primary text-primary-foreground shadow-raised hover:-translate-y-px hover:bg-primary-emphasis hover-shadow-floating",
    disabled:
      "border-transparent bg-primary text-primary-foreground shadow-raised",
  },
  ghost: {
    enabled:
      "border-border bg-surface-control text-foreground shadow-flat hover:-translate-y-px hover:border-strong hover:bg-surface-elevated",
    disabled:
      "border-border bg-surface-control text-foreground shadow-flat",
  },
  danger: {
    enabled:
      "border-danger/20 bg-danger/10 text-danger shadow-flat hover:-translate-y-px hover:border-danger/35 hover:bg-danger/12",
    disabled:
      "border-danger/20 bg-danger/10 text-danger shadow-flat",
  },
  soft: {
    enabled:
      "border-primary/10 bg-primary-soft text-primary shadow-flat hover:-translate-y-px hover:border-primary/20 hover:bg-primary-soft/90",
    disabled:
      "border-primary/10 bg-primary-soft text-primary shadow-flat",
  },
  secondary: {
    enabled:
      "border-border/70 bg-surface-muted text-foreground shadow-flat hover:-translate-y-px hover:border-strong hover:bg-surface-control",
    disabled:
      "border-border/70 bg-surface-muted text-foreground shadow-flat",
  },
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
  ariaPressed?: boolean;
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
  ariaPressed,
  title,
  style,
  form,
  formAction,
}: ButtonProps) {
  const isDisabled = Boolean(disabled || loading);
  const safeRel = buildLinkRel(target, rel);
  const classes = cn(
    base,
    isDisabled ? "cursor-default" : "cursor-pointer",
    isDisabled ? variants[variant].disabled : variants[variant].enabled,
    sizes[size],
    isDisabled ? "opacity-60" : null,
    className,
  );
  const content = (
    <span className="inline-flex items-center gap-3">
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
      "aria-pressed": ariaPressed,
      title,
      target,
      rel: safeRel,
      "aria-disabled": isDisabled || undefined,
      tabIndex: isDisabled ? -1 : undefined,
      onClick: handleLinkClick,
    };

    if (isInternalHref(href)) {
      return (
        <Link href={href} prefetch={prefetch ?? false} {...sharedProps}>
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
      aria-pressed={ariaPressed}
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
