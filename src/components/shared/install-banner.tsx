"use client";

import { Download, X } from "lucide-react";
import { ActionButton } from "@/components/shared/action-button";
import { Panel } from "@/components/shared/panel";
import { useInstallReadiness } from "@/lib/install/use-install-readiness";
import { getBuildMetadata } from "@/lib/product/build-metadata";

const buildMetadata = getBuildMetadata();

export function InstallBanner() {
  const { canInstall, requestInstall, dismissInstall } = useInstallReadiness();

  if (!canInstall) {
    return null;
  }

  return (
    <Panel className="flex flex-col gap-3 border-accent/20 bg-accentSoft sm:flex-row sm:items-center sm:justify-between">
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
