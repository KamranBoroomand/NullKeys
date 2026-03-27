"use client";

import { classNames } from "@/lib/utils/class-names";

export interface SegmentedControlOption {
  id: string;
  label: string;
  description?: string;
}

export function SegmentedControl({
  label,
  value,
  options,
  onChange,
  compact = false,
}: {
  label: string;
  value: string;
  options: SegmentedControlOption[];
  onChange: (nextValue: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-textMuted">{label}</p>
      <div
        className={classNames(
          "grid gap-2 rounded-[1.6rem] border border-borderTone/75 bg-[hsl(var(--surface-inset)/0.9)] p-2 shadow-[inset_0_1px_0_hsl(var(--text)/0.03)]",
          compact ? "grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-3",
        )}
      >
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={classNames(
              "rounded-[1.2rem] border px-3 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              value === option.id
                ? "border-accent/44 bg-[hsl(var(--surface-raised)/0.96)] text-text shadow-airy"
                : "border-transparent bg-transparent text-textMuted hover:border-borderTone/80 hover:bg-[hsl(var(--surface-raised)/0.72)] hover:text-text",
            )}
          >
            <p className="text-sm font-semibold">{option.label}</p>
            {option.description ? (
              <p className="mt-1 text-xs leading-5 text-textMuted">{option.description}</p>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
