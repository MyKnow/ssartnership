export default function SectionTitle({
  label,
}: {
  label: string;
}) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
      {label}
    </p>
  );
}
