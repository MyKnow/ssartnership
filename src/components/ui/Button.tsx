import { cn } from "@/lib/cn";

const base =
  "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition";

const variants = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  ghost: "border border-border bg-surface text-foreground hover:border-strong",
  danger:
    "border border-danger/40 text-danger hover:border-danger/70 dark:border-danger/40",
};

type ButtonProps = {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  className?: string;
  type?: "button" | "submit" | "reset";
  href?: string;
  target?: string;
  rel?: string;
  onClick?: () => void;
  disabled?: boolean;
};

export default function Button({
  children,
  variant = "primary",
  className,
  type = "button",
  href,
  target,
  rel,
  onClick,
  disabled,
}: ButtonProps) {
  const classes = cn(
    base,
    variants[variant],
    disabled ? "cursor-not-allowed opacity-60" : null,
    className,
  );

  if (href) {
    return (
      <a href={href} className={classes} target={target} rel={rel}>
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
    >
      {children}
    </button>
  );
}
