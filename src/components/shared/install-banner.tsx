"use client";

import { Download, RefreshCw, X } from "lucide-react";
import { ActionButton } from "@/components/shared/action-button";
import { Panel } from "@/components/shared/panel";
import { useInstallReadiness } from "@/lib/install/use-install-readiness";
import { getBuildMetadata } from "@/lib/product/build-metadata";

const buildMetadata = getBuildMetadata();

export function InstallBanner() {
  const {
    canInstall,
    updateAvailable,
    updateBlocked,
    typingSessionActive,
    requestInstall,
    dismissInstall,
    activateUpdate,
  } = useInstallReadiness();

  if (!canInstall && !updateAvailable) {
    return null;
  }

  if (updateAvailable) {
    return (
      <Panel className="mb-4 flex flex-col gap-3 border-accent/20 bg-accentSoft sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-text">
            A newer {buildMetadata.name} build is ready.
          </p>
          <p className="text-sm text-textMuted">
            {typingSessionActive
              ? "Finish or stop the active lesson before updating. This tab will not reload mid-session."
              : updateBlocked
                ? "Another open tab is still typing. Finish that session, then try again."
                : "The update will activate only after every open tab confirms that no lesson is active."}
          </p>
        </div>
        <ActionButton onClick={activateUpdate} disabled={typingSessionActive}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Update
        </ActionButton>
      </Panel>
    );
  }

  return (
    <Panel className="mb-4 flex flex-col gap-3 border-accent/20 bg-accentSoft sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-text">
          Install {buildMetadata.name} for a cleaner practice loop.
        </p>
        <p className="text-sm text-textMuted">
          Supported browsers can pin this local-first app and keep your progress on-device.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <ActionButton onClick={() => void requestInstall()}>
          <Download className="mr-2 h-4 w-4" />
          Install
        </ActionButton>
        <ActionButton tone="ghost" onClick={dismissInstall} aria-label="Dismiss install banner">
          <X className="h-4 w-4" />
        </ActionButton>
      </div>
    </Panel>
  );
}
