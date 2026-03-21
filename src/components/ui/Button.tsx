import { cn } from "@/lib/cn";

const base =
  "inline-flex items-center justify-center rounded-full font-semibold leading-none transition";

const sizes = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-11 px-5 text-base",
  icon: "h-9 w-9 p-0 text-sm",
};

const variants = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  ghost: "border border-border bg-surface text-foreground hover:border-strong",
  danger:
    "border border-danger/40 text-danger hover:border-danger/70 dark:border-danger/40",
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
};

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
}: ButtonProps) {
  const classes = cn(
    base,
    variants[variant],
    sizes[size],
    disabled ? "cursor-not-allowed opacity-60" : null,
    className,
  );

  if (href) {
    return (
      <a
        href={href}
        className={classes}
        target={target}
        rel={rel}
        aria-label={ariaLabel}
        title={title}
      >
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
    >
      {children}
    </button>
  );
}
