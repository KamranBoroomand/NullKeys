"use client";

import { DatabaseZap, Download, ShieldCheck, Upload } from "lucide-react";
import { ActionButton } from "@/components/shared/action-button";
import { SettingsSection } from "@/features/user-preferences/settings-section";
import { LOCAL_PROFILE_ARCHIVE_VERSION } from "@/lib/persistence/local-profile-archive";

export interface LocalDataSummary {
  archiveVersion: number;
  appSchemaVersion: number;
  summary: {
    sessionCount: number;
    learnerProgressProfileCount: number;
    contentCacheEntryCount: number;
    preferencesSchemaVersion: number;
  };
}

interface SettingsLocalDataSectionProps {
  summary: LocalDataSummary | null;
  build: { name: string; version: string; tagline: string; packageVersion: string; buildId: string; contentPackVersion: string; buildString: string };
  onCopyBuild: () => void;
  onClearHistory: () => void;
  onReopenGuides: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onResetAll: () => void;
}

export function SettingsLocalDataSection({ summary, build, onCopyBuild, onClearHistory, onReopenGuides, onExport, onImport, onResetAll }: SettingsLocalDataSectionProps) {
  return (
    <SettingsSection testId="settings-section-privacy" title="Privacy and local data" description="Typing input, preferences, session history, and learner profiles remain in this browser.">
      <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
        <div className="flex items-start gap-3"><ShieldCheck className="mt-1 h-5 w-5 text-accent" /><div className="space-y-2 text-sm leading-6 text-textMuted"><p>No account, cloud sync, telemetry, or remote profile is used. Preferences, history, progression, and cached content are stored in IndexedDB.</p><p>Clearing browser storage removes that data because there is no server-side copy.</p></div></div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Sessions" value={summary ? String(summary.summary.sessionCount) : "…"} detail="Saved local session records." />
        <SummaryCard label="Learner profiles" value={summary ? String(summary.summary.learnerProgressProfileCount) : "…"} detail="Adaptive progression snapshots." />
        <SummaryCard label="Cached entries" value={summary ? String(summary.summary.contentCacheEntryCount) : "…"} detail="Rebuildable local content helpers." />
        <SummaryCard label="Archive format" value={`v${summary?.archiveVersion ?? LOCAL_PROFILE_ARCHIVE_VERSION}`} detail={summary ? `Database schema v${summary.appSchemaVersion}.` : "Checking schema details…"} />
      </div>
      <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Product build</p><p className="text-lg font-semibold text-text" data-testid="settings-build-version">v{build.version}</p><p className="text-sm text-textMuted">{build.tagline}</p><p className="text-xs text-textMuted">Package v{build.packageVersion} · build {build.buildId} · packs {build.contentPackVersion}</p></div><ActionButton tone="secondary" onClick={onCopyBuild}>Copy build string</ActionButton></div>
      </div>
      <div className="grid gap-3 md:grid-cols-2"><p className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4 text-sm leading-6 text-textMuted">Export writes a checksummed JSON archive with preferences, complete saved-session history, and learner profiles. Rebuildable caches are excluded.</p><p className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4 text-sm leading-6 text-textMuted">Import validates the hash and every nested record before replacing the active profile in one IndexedDB transaction.</p></div>
      <div className="grid gap-3 md:grid-cols-2"><ActionButton tone="danger" onClick={onClearHistory}><DatabaseZap className="mr-2 h-4 w-4" />Clear local history</ActionButton><ActionButton tone="secondary" onClick={onReopenGuides}>Reopen onboarding and guide</ActionButton></div>
      <div className="grid gap-3 md:grid-cols-2"><ActionButton tone="secondary" onClick={onExport}><Download className="mr-2 h-4 w-4" />Export local archive</ActionButton><label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-borderTone px-4 py-2 text-sm font-medium text-text"><Upload className="mr-2 h-4 w-4" />Import local archive<input type="file" accept="application/json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file); event.currentTarget.value = ""; }} /></label></div>
      <ActionButton tone="danger" onClick={onResetAll}>Reset all local data</ActionButton>
    </SettingsSection>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-xl border border-borderTone/80 bg-panelMuted px-4 py-4"><p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">{label}</p><p className="mt-2 text-lg font-semibold text-text">{value}</p><p className="mt-1 text-sm text-textMuted">{detail}</p></div>;
}
