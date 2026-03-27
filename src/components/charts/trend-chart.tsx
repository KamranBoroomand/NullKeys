import { useId } from "react";

interface TrendChartProps {
  title: string;
  data: Array<{ label: string; value: number }>;
  colorClassName?: string;
}

function formatChartLabel(label: string) {
  if (!label) {
    return "";
  }

  const parsedDate = new Date(label);
  if (!Number.isNaN(parsedDate.getTime())) {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
    }).format(parsedDate);
  }

  return label;
}

export function TrendChart({ title, data, colorClassName = "stroke-accent" }: TrendChartProps) {
  const gradientId = useId().replace(/:/g, "");
  const values = data.map((point) => point.value);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const spread = Math.max(maxValue - minValue, 1);
  const horizontalGuides = Array.from({ length: 4 }, (_, index) => {
    const share = index / 3;
    return {
      y: 8 + share * 84,
      value: Number((maxValue - spread * share).toFixed(1)),
    };
  });
  const pathDefinition = data
    .map((point, index) => {
      const x = 8 + (index / Math.max(data.length - 1, 1)) * 84;
      const y = 92 - ((point.value - minValue) / spread) * 84;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  const pointCoordinates = data.map((point, index) => ({
    x: 8 + (index / Math.max(data.length - 1, 1)) * 84,
    y: 92 - ((point.value - minValue) / spread) * 84,
    value: point.value,
  }));
  const firstLabel = formatChartLabel(data[0]?.label ?? "");
  const lastLabel = formatChartLabel(data[data.length - 1]?.label ?? "");

  return (
    <div className="space-y-3 rounded-[0.8rem] border border-borderTone/70 bg-[hsl(var(--surface-raised)/0.84)] px-4 py-4 shadow-[inset_0_1px_0_hsl(var(--text)/0.03)]">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        <p className="text-xs uppercase tracking-[0.24em] text-textMuted">
          {data.length} sessions
        </p>
      </div>
      <div className="rounded-[0.78rem] border border-borderTone/55 bg-[hsl(var(--surface-inset)/0.92)] px-3 py-3">
        {data.length > 1 ? (
          <svg viewBox="0 0 100 100" className="h-44 w-full overflow-visible">
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="hsla(var(--accent), 0.3)" />
                <stop offset="100%" stopColor="hsla(var(--accent), 0.02)" />
              </linearGradient>
            </defs>
            {horizontalGuides.map((guide) => (
              <g key={`${title}-${guide.value}`}>
                <line
                  x1="8"
                  x2="92"
                  y1={guide.y}
                  y2={guide.y}
                  stroke="hsl(var(--border-tone) / 0.38)"
                  strokeDasharray="2 3"
                />
                <text
                  x="2"
                  y={guide.y + 2}
                  fontSize="4.5"
                  textAnchor="start"
                  fill="hsl(var(--text-muted) / 0.82)"
                >
                  {guide.value}
                </text>
              </g>
            ))}
            <path d={`${pathDefinition} L 92 92 L 8 92 Z`} fill={`url(#${gradientId})`} />
            <path
              d={pathDefinition}
              fill="none"
              className={`stroke-[2.4] ${colorClassName}`}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {pointCoordinates.map((point, index) => (
              <circle
                key={`${title}-point-${index}`}
                cx={point.x}
                cy={point.y}
                r="1.4"
                fill="hsl(var(--canvas))"
                stroke="hsl(var(--accent) / 0.95)"
                strokeWidth="1.2"
              />
            ))}
          </svg>
        ) : (
          <div className="flex h-44 items-center justify-center text-sm text-textMuted">
            Complete a few sessions to unlock trend lines.
          </div>
        )}
        {data.length > 1 ? (
          <div className="mt-2 flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-textMuted">
            <span>{firstLabel}</span>
            <span>{lastLabel}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
