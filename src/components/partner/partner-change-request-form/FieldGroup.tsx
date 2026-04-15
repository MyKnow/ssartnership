export function FieldGroup({
  label,
  children,
  note,
}: {
  label: string;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
    </label>
  );
}
