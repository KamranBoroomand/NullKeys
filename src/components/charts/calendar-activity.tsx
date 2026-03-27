export interface CalendarActivityDay {
  label: string;
  sessionCount: number;
  totalMinutes: number;
}

export function CalendarActivity({
  title,
  description,
  days,
}: {
  title: string;
  description: string;
  days: CalendarActivityDay[];
}) {
  const strongestDay = Math.max(...days.map((day) => day.sessionCount), 1);

  return (
    <div className="space-y-3 rounded-[0.8rem] border border-borderTone/70 bg-[hsl(var(--surface-raised)/0.84)] px-4 py-4 shadow-[inset_0_1px_0_hsl(var(--text)/0.03)]">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-text">{title}</h3>
        <p className="text-sm text-textMuted">{description}</p>
      </div>
      {days.length === 0 ? (
        <p className="text-sm text-textMuted">Daily activity appears after you save a few sessions.</p>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {days.map((day) => {
            const intensity = Math.max(0.08, day.sessionCount / strongestDay);

            return (
              <div
                key={day.label}
                className="rounded-[0.72rem] border border-borderTone/45 px-2 py-2 text-center"
                style={{
                  backgroundColor: `hsl(var(--accent) / ${Math.min(0.52, intensity * 0.58)})`,
                }}
                title={`${day.label}: ${day.sessionCount} sessions, ${day.totalMinutes} minutes`}
              >
                <p className="text-[11px] font-semibold text-text">{day.label}</p>
                <p className="mt-1 text-xs text-text">{day.sessionCount}</p>
                <p className="text-[10px] text-textMuted">{day.totalMinutes}m</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
