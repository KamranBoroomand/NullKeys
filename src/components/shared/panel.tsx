import type { HTMLAttributes, PropsWithChildren } from "react";
import { classNames } from "@/lib/utils/class-names";

export function Panel({
  className,
  children,
  ...divProps
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      className={classNames(
        "rounded-[0.75rem] border border-borderTone/70 bg-[hsl(var(--surface-raised)/0.86)] p-4 shadow-[0_18px_38px_-34px_hsl(var(--modal-shadow)/0.5),inset_0_1px_0_hsl(var(--text)/0.05)] sm:p-[1.05rem]",
        className,
      )}
      {...divProps}
    >
      {children}
    </div>
  );
}
