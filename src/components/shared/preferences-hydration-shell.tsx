import { PageFrame } from "@/components/shared/page-frame";
import { Panel } from "@/components/shared/panel";
import { defaultPracticePreferences } from "@/features/user-preferences/preferences-schema";

export function PreferencesHydrationShell({
  title,
  description,
  eyebrow,
}: {
  title: string;
  description: string;
  eyebrow?: string;
}) {
  return (
    <PageFrame
      title={title}
      description={description}
      eyebrow={eyebrow}
      themeChoice={defaultPracticePreferences.themeChoice}
    >
      <Panel
        className="min-h-52 space-y-5"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <p className="text-sm font-medium text-text">Loading local preferences…</p>
        <p className="max-w-xl text-sm leading-6 text-textMuted">
          The page shell is ready while this browser opens its on-device settings. No typed text is
          sent anywhere.
        </p>
        <div aria-hidden="true" className="grid gap-3 sm:grid-cols-2">
          <div className="h-20 rounded-[0.45rem] border border-borderTone/55 bg-[hsl(var(--surface-inset)/0.45)]" />
          <div className="h-20 rounded-[0.45rem] border border-borderTone/55 bg-[hsl(var(--surface-inset)/0.45)]" />
        </div>
      </Panel>
    </PageFrame>
  );
}
