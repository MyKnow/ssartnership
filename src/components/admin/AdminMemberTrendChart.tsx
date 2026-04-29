import Card from "@/components/ui/Card";
import SectionHeading from "@/components/ui/SectionHeading";

export type AdminMemberTrendPoint = {
  label: string;
  value: number;
  cumulative: number;
};

function buildPath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

export default function AdminMemberTrendChart({
  points,
}: {
  points: AdminMemberTrendPoint[];
}) {
  const width = Math.max(points.length * 72, 480);
  const height = 240;
  const padding = { top: 24, right: 20, bottom: 48, left: 44 };
  const plotWidth = Math.max(width - padding.left - padding.right, 1);
  const plotHeight = Math.max(height - padding.top - padding.bottom, 1);
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const stepX = points.length > 1 ? plotWidth / (points.length - 1) : 0;
  const coords = points.map((point, index) => ({
    ...point,
    x: padding.left + stepX * index,
    y: padding.top + plotHeight * (1 - point.value / maxValue),
  }));

  return (
    <Card tone="elevated" className="min-w-0 overflow-hidden">
      <SectionHeading
        title="회원 유입 추이"
        description="현재 필터 기준 회원 생성 이력을 월별 꺾은선으로 확인합니다."
      />

      <div className="-mx-1 mt-5 overflow-x-auto pb-2">
        <div className="min-w-max px-1">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="block h-auto min-w-full"
            role="img"
            aria-label="회원 유입 추이 차트"
          >
            {Array.from({ length: 4 }, (_, index) => {
              const y = padding.top + plotHeight * (index / 3);
              const value = Math.round(maxValue * (1 - index / 3));
              return (
                <g key={`grid-${index}`} className="text-border/70">
                  <line
                    x1={padding.left}
                    x2={width - padding.right}
                    y1={y}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity={index === 3 ? 0.2 : 0.08}
                    strokeDasharray={index === 3 ? "0" : "3 7"}
                  />
                  <text
                    x={padding.left - 10}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-muted-foreground text-[10px] font-medium"
                  >
                    {value}
                  </text>
                </g>
              );
            })}

            <path d={buildPath(coords)} fill="none" stroke="currentColor" strokeWidth="3" className="text-primary" />

            {coords.map((point) => (
              <g key={point.label}>
                <circle cx={point.x} cy={point.y} r="5" className="fill-primary" />
                <text
                  x={point.x}
                  y={height - 18}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px] font-medium"
                >
                  {point.label}
                </text>
              </g>
            ))}
          </svg>

          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {points.slice(-4).map((point) => (
              <div
                key={`summary-${point.label}`}
                className="rounded-2xl border border-border bg-surface-inset px-3 py-3"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {point.label}
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {point.value.toLocaleString()}명
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  누적 {point.cumulative.toLocaleString()}명
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
