export interface DistributionBucket {
  label: string;
  count: number;
}

export function DistributionChart({
  title,
  description,
  buckets,
  accentClassName = "bg-accent",
}: {
  title: string;
  description: string;
  buckets: DistributionBucket[];
  accentClassName?: string;
}) {
  const largestBucketCount = Math.max(...buckets.map((bucket) => bucket.count), 1);

  return (
    <div className="space-y-3 rounded-[0.8rem] border border-borderTone/70 bg-[hsl(var(--surface-raised)/0.84)] px-4 py-4 shadow-[inset_0_1px_0_hsl(var(--text)/0.03)]">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-text">{title}</h3>
        <p className="text-sm text-textMuted">{description}</p>
      </div>
      {buckets.length === 0 ? (
        <p className="text-sm text-textMuted">More sessions are needed before the distribution can be drawn.</p>
      ) : (
        <div className="grid grid-cols-6 gap-2">
          {buckets.map((bucket) => (
            <div key={bucket.label} className="space-y-2">
              <div className="relative flex h-36 items-end overflow-hidden rounded-[0.72rem] border border-borderTone/55 bg-[hsl(var(--surface-inset)/0.92)] px-2 py-3">
                <div className="absolute inset-x-2 inset-y-3 grid grid-rows-4 gap-0">
                  {Array.from({ length: 4 }, (_, index) => (
                    <div
                      key={`${bucket.label}-guide-${index}`}
                      className="border-t border-dashed border-borderTone/25"
                    />
                  ))}
                </div>
                <div className="absolute left-1/2 top-2 -translate-x-1/2 text-[11px] font-medium text-textMuted">
                  {bucket.count}
                </div>
                <div
                  className={`relative z-10 w-full rounded-[0.65rem] ${accentClassName}`}
                  style={{
                    height: `${Math.max(10, (bucket.count / largestBucketCount) * 100)}%`,
                  }}
                />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-text">{bucket.label}</p>
                <p className="text-xs text-textMuted">{bucket.count}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
