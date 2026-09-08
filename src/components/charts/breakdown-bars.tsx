interface BreakdownBarsProps {
  title: string;
  items: Array<{ label: string; count: number }>;
}

export function BreakdownBars({ title, items }: BreakdownBarsProps) {
  const largestCount = Math.max(...items.map((item) => item.count), 1);
  const totalCount = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="space-y-3 rounded-[0.8rem] border border-borderTone/70 bg-[hsl(var(--surface-raised)/0.84)] px-4 py-4 shadow-[inset_0_1px_0_hsl(var(--text)/0.03)]">
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-textMuted">No saved sessions yet.</p>
        ) : (
          items.map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm text-textMuted">
                <span>{item.label}</span>
                <span>
                  {item.count}
                  {totalCount > 0 ? ` · ${Math.round((item.count / totalCount) * 100)}%` : ""}
                </span>
              </div>
              <div className="h-2 rounded-full bg-[hsl(var(--surface-inset)/0.92)]">
                <div
                  className="h-2 rounded-full bg-accent"
                  style={{ width: `${Math.max(6, (item.count / largestCount) * 100)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
