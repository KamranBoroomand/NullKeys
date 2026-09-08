"use client";

import { useSyncExternalStore } from "react";
import { ActionButton } from "@/components/shared/action-button";
import { Panel } from "@/components/shared/panel";
import { initializePracticePreferences } from "@/features/user-preferences/preferences-store";
import {
  getAppDatabaseConnectionSnapshot,
  retryAppDatabaseConnection,
  subscribeToAppDatabaseConnection,
} from "@/lib/persistence/browser-database";

const serverStorageSnapshot = {
  status: "idle" as const,
  errorMessage: null,
  blockedByVersion: null,
};

export function BrowserStorageStatusBanner() {
  const snapshot = useSyncExternalStore(
    subscribeToAppDatabaseConnection,
    getAppDatabaseConnectionSnapshot,
    () => serverStorageSnapshot,
  );

  if (!(["blocked", "failed", "reconnecting", "closed"] as const).includes(
    snapshot.status as "blocked" | "failed" | "reconnecting" | "closed",
  )) return null;

  const canRetry = snapshot.status === "failed" || snapshot.status === "closed";
  return (
    <Panel className="mb-4 flex flex-col gap-3 border-danger/30 sm:flex-row sm:items-center sm:justify-between" role="alert">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-text">
          {snapshot.status === "blocked" ? "Another tab is blocking local storage" : "Local storage needs attention"}
        </p>
        <p className="text-sm leading-6 text-textMuted">
          {snapshot.errorMessage ?? "NullKeys is reconnecting to this browser's on-device database. Existing data has not been reset."}
        </p>
      </div>
      {canRetry ? (
        <ActionButton
          tone="secondary"
          onClick={() => {
            void retryAppDatabaseConnection()
              .then(() => initializePracticePreferences())
              .catch(() => undefined);
          }}
        >
          Retry storage
        </ActionButton>
      ) : null}
    </Panel>
  );
}
