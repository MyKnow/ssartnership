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

function getReadableTextColor(color: string) {
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance >= 160 ? "#111827" : color;
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
        color: getReadableTextColor(normalizedColor),
      }}
    >
      {label}
    </Badge>
  );
}
