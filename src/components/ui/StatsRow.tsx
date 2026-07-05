import DataPanel from "@/components/ui/DataPanel";
import ResponsiveGrid from "@/components/ui/ResponsiveGrid";

type StatsRowItem = {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
};

export default function StatsRow({
  items,
  minItemWidth = "14rem",
}: {
  items: StatsRowItem[];
  minItemWidth?: string;
}) {
  return (
    <ResponsiveGrid minItemWidth={minItemWidth}>
      {items.map((item) => (
        <DataPanel
          key={item.label}
          label={item.label}
          title={
            <span className="min-w-0 text-2xl font-semibold tracking-normal text-foreground">
              {item.value}
            </span>
          }
          description={item.hint}
        />
      ))}
    </ResponsiveGrid>
  );
}
