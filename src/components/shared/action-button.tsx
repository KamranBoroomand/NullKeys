"use client";

import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { classNames } from "@/lib/utils/class-names";

interface ActionButtonProps
  extends PropsWithChildren,
    ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: "primary" | "secondary" | "ghost" | "danger";
  block?: boolean;
}

export function ActionButton({
  children,
  className,
  tone = "primary",
  block = false,
  ...buttonProps
}: ActionButtonProps) {
  return (
    <button
      className={classNames(
        "inline-flex min-h-8 items-center justify-center rounded-[0.4rem] border px-3 py-1.5 text-[13px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--focus-ring))] disabled:cursor-not-allowed disabled:opacity-55",
        tone === "primary" &&
          "border-accent/32 bg-accentSoft/85 text-text hover:border-accent/48 hover:bg-[hsl(var(--accent)/0.18)]",
        tone === "secondary" &&
          "border-borderTone/70 bg-[hsl(var(--surface-raised)/0.88)] text-text hover:border-accent/30 hover:bg-[hsl(var(--surface-raised)/0.96)]",
        tone === "ghost" &&
          "border-transparent bg-transparent text-textMuted hover:bg-[hsl(var(--surface-inset)/0.72)] hover:text-text",
        tone === "danger" && "border-danger/35 bg-danger/10 text-danger hover:bg-danger/15",
        block && "w-full",
        className,
      )}
      {...buttonProps}
    >
      {children}
    </button>
  );
}
