import type { ReactNode } from "react";
import { Panel } from "@/components/shared/panel";

export function SettingsSection({
  testId,
  title,
  description,
  children,
}: {
  testId: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Panel className="space-y-5" data-testid={testId}>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-text">{title}</h2>
        <p className="text-sm leading-6 text-textMuted">{description}</p>
      </div>
      <div className="grid gap-4">{children}</div>
    </Panel>
  );
}
