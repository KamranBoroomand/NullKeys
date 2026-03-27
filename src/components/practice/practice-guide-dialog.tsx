"use client";

import { useEffect, useState } from "react";
import { ActionButton } from "@/components/shared/action-button";

export interface PracticeGuideStep {
  title: string;
  body: string;
}

export function PracticeGuideDialog({
  open,
  onClose,
  steps,
}: {
  open: boolean;
  onClose: () => void;
  steps: PracticeGuideStep[];
}) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setStepIndex(0);
    }
  }, [open]);

  if (!open || steps.length === 0) {
    return null;
  }

  const step = steps[stepIndex];

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[hsl(var(--overlay-backdrop)/0.78)] px-4"
      data-testid="practice-guide-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="practice-guide-title"
    >
      <div className="w-full max-w-xl space-y-5 rounded-[1.1rem] border border-modalBorder bg-modalSurface px-6 py-6 text-modalText shadow-[0_32px_72px_-32px_hsl(var(--modal-shadow)/0.68),0_16px_28px_-20px_hsl(var(--modal-shadow)/0.48)]">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">
            Guided tour
          </p>
          <h2 id="practice-guide-title" className="text-2xl font-semibold text-modalText">
            {step.title}
          </h2>
          <p className="text-sm leading-7 text-[hsl(var(--modal-text-muted))]">{step.body}</p>
        </div>
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs uppercase tracking-[0.22em] text-[hsl(var(--modal-text-muted))]">
            Step {stepIndex + 1} / {steps.length}
          </p>
          <div className="flex gap-2">
            <ActionButton
              tone="ghost"
              className="border border-modalBorder bg-[hsl(var(--modal-surface-muted)/0.88)] text-modalText hover:bg-[hsl(var(--modal-surface-muted))]"
              onClick={() => {
                if (stepIndex === 0) {
                  onClose();
                  return;
                }

                setStepIndex((currentStepIndex) => currentStepIndex - 1);
              }}
            >
              Back
            </ActionButton>
            <ActionButton
              tone="secondary"
              className="border border-modalBorder bg-[hsl(var(--modal-surface-muted))] text-modalText hover:bg-[hsl(var(--modal-surface-muted)/0.92)]"
              onClick={() => {
                setStepIndex(steps.length - 1);
              }}
            >
              Skip tour
            </ActionButton>
            <ActionButton
              className="border border-transparent bg-surfaceStrong text-surfaceStrongText hover:bg-[hsl(var(--surface-strong-hover))]"
              onClick={() => {
                if (stepIndex >= steps.length - 1) {
                  onClose();
                  setStepIndex(0);
                  return;
                }

                setStepIndex((currentStepIndex) => currentStepIndex + 1);
              }}
            >
              {stepIndex >= steps.length - 1 ? "Done" : "Next"}
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}
