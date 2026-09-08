"use client";

import type { SelectHTMLAttributes } from "react";
import { classNames } from "@/lib/utils/class-names";

export function FieldLabel({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold text-text">{title}</p>
      {description ? <p className="text-sm text-textMuted">{description}</p> : null}
    </div>
  );
}

export function SelectField({
  className,
  ...selectProps
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={classNames(
        "min-h-11 rounded-2xl border border-popoverBorder bg-[hsl(var(--popover-surface)/0.98)] px-3 text-sm text-popoverText shadow-[inset_0_1px_0_hsl(var(--text)/0.04),0_8px_18px_-16px_hsl(var(--modal-shadow)/0.45)] outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25",
        className,
      )}
      {...selectProps}
    />
  );
}

export function ToggleField({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-3xl border border-borderTone/75 bg-[hsl(var(--surface-raised)/0.88)] px-4 py-3 shadow-[inset_0_1px_0_hsl(var(--text)/0.03)]">
      <FieldLabel title={title} description={description} />
      <span
        className={classNames(
          "mt-1 inline-flex h-7 w-12 items-center rounded-full border transition",
          checked
            ? "border-[hsl(var(--surface-strong))] bg-surfaceStrong"
            : "border-borderTone/75 bg-[hsl(var(--surface-inset)/0.92)]",
        )}
      >
        <span
          className={classNames(
            "ml-1 h-5 w-5 rounded-full border border-popoverBorder bg-popoverSurface shadow-sm transition",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </span>
      <input
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
        className="sr-only"
      />
    </label>
  );
}
