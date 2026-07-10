import Badge from "@/components/ui/Badge";

function normalizeHexColor(value?: string | null) {
  const color = String(value ?? "").trim();
  if (!/^#([\da-f]{3}|[\da-f]{6})$/i.test(color)) {
    return null;
  }
  if (color.length === 4) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }
  return color;
}

export default function CategoryColorBadge({
  label,
  color,
  className,
}: {
  label: string;
  color?: string | null;
  className?: string;
}) {
  const normalizedColor = normalizeHexColor(color);

  if (!normalizedColor) {
    return <Badge className={className}>{label}</Badge>;
  }

  return (
    <Badge
      className={className}
      style={{
        backgroundColor: `${normalizedColor}18`,
        borderColor: `${normalizedColor}55`,
        color: "var(--foreground)",
      }}
    >
      {label}
    </Badge>
  );
}
