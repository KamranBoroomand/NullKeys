import { classNames } from "@/lib/utils/class-names";

export interface HeatGridCell {
  label: string;
  value: number;
  hint?: string;
}

export function HeatGrid({
  title,
  description,
  cells,
  columns = 6,
}: {
  title: string;
  description: string;
  cells: HeatGridCell[];
  columns?: number;
}) {
  const highestValue = Math.max(...cells.map((cell) => cell.value), 1);

  return (
    <div className="space-y-3 rounded-[0.8rem] border border-borderTone/70 bg-[hsl(var(--surface-raised)/0.84)] px-4 py-4 shadow-[inset_0_1px_0_hsl(var(--text)/0.03)]">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-text">{title}</h3>
        <p className="text-sm text-textMuted">{description}</p>
      </div>
      {cells.length === 0 ? (
        <p className="text-sm text-textMuted">No local samples are available yet.</p>
      ) : (
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {cells.map((cell) => {
            const intensity = Math.max(0.08, cell.value / highestValue);

            return (
              <div
                key={cell.label}
                className={classNames(
                  "rounded-[0.72rem] border border-borderTone/45 px-3 py-3 text-center transition",
                  "hover:border-accent/40",
                )}
                style={{
                  background:
                    `linear-gradient(180deg, hsl(var(--accent) / ${Math.min(0.58, intensity * 0.48)}), hsl(var(--accent) / ${Math.min(0.82, intensity * 0.74)}))`,
                }}
                title={cell.hint}
              >
                <p className="text-lg font-semibold text-text">{cell.label}</p>
                <p className="text-xs text-text">{Math.round(cell.value)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
