import { Panel } from "@/components/shared/panel";
import { classNames } from "@/lib/utils/class-names";

interface StatTileProps {
  label: string;
  value: string;
  accent?: "default" | "success" | "warn";
}

export function StatTile({ label, value, accent = "default" }: StatTileProps) {
  const testId = `stat-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <Panel className="space-y-1 p-4" data-testid={testId}>
      <p className="text-xs uppercase tracking-[0.24em] text-textMuted">{label}</p>
      <p
        className={classNames(
          "text-2xl font-semibold text-text",
          accent === "success" && "text-success",
          accent === "warn" && "text-warn",
        )}
      >
        {value}
      </p>
    </Panel>
  );
}
