"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { RotateCcw, SkipForward } from "lucide-react";
import { PromptBoardContent, getPromptRenderMode } from "@/components/practice/prompt-board-content";
import { ActionButton } from "@/components/shared/action-button";
import { StatTile } from "@/components/shared/stat-tile";
import type { ScriptFamily } from "@/content/languages/language-text-metadata";
import type { WhitespaceStyle } from "@/features/user-preferences/preferences-schema";
import {
  clampTypingValueToPromptLength,
  removeTrailingTypingCluster,
} from "@/lib/input/typing-markers";
import { formatDuration, formatPercent, formatRate } from "@/lib/utils/formatting";
import type { SessionMetrics } from "@/lib/scoring/session-models";
import { classNames } from "@/lib/utils/class-names";

interface TypingSurfaceProps {
  promptText: string;
  typedText: string;
  inputValue: string;
  onTypedTextChange: (value: string) => void;
  onCompositionStart: () => void;
  onCompositionUpdate: (value: string) => void;
  onCompositionEnd: (value: string) => void;
  sessionMetrics: SessionMetrics;
  remainingMs: number | null;
  languageId: string;
  localeTag: string;
  scriptFamily: ScriptFamily;
  direction: "ltr" | "rtl";
  keyboardInset?: number;
  statusMessage: string | null;
  warningMessage?: string | null;
  onRestart: () => void;
  onSkip: () => void;
  inputMode: "hardware" | "touch";
  imeProfile: "direct" | "ime-light" | "ime-required";
  presentationMode?: "full" | "compact" | "minimal";
  whitespaceStyle?: WhitespaceStyle;
  showStatTiles?: boolean;
  showSessionControls?: boolean;
  showProgressBar?: boolean;
  showReadyMessage?: boolean;
  capturePaused?: boolean;
  headerSlot?: ReactNode;
  footerSlot?: ReactNode;
  promptWrapperClassName?: string;
  promptBoardClassName?: string;
}

function isEditableElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

function isInteractiveControlElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest("button, a, input, textarea, select, summary, [role='button'], [role='link']"),
  );
}

function applyHardwareKey(inputValue: string, key: string, maxLength: number) {
  if (key === "Backspace") {
    return removeTrailingTypingCluster(inputValue);
  }

  if (key === "Spacebar") {
    return clampTypingValueToPromptLength(`${inputValue} `, maxLength);
  }

  if (key.length === 1) {
    return clampTypingValueToPromptLength(`${inputValue}${key}`, maxLength);
  }

  return null;
}

export function TypingSurface({
  promptText,
  typedText,
  inputValue,
  onTypedTextChange,
  onCompositionStart,
  onCompositionUpdate,
  onCompositionEnd,
  sessionMetrics,
  remainingMs,
  languageId,
  localeTag,
  scriptFamily,
  direction,
  keyboardInset = 0,
  statusMessage,
  warningMessage = null,
  onRestart,
  onSkip,
  inputMode,
  imeProfile,
  presentationMode = "full",
  whitespaceStyle = "bullet",
  showStatTiles = true,
  showSessionControls = true,
  showProgressBar = true,
  showReadyMessage = true,
  capturePaused = false,
  headerSlot,
  footerSlot,
  promptWrapperClassName,
  promptBoardClassName,
}: TypingSurfaceProps) {
  const captureInputReference = useRef<HTMLTextAreaElement | null>(null);
  const latestInputValueReference = useRef(inputValue);
  const promptRenderMode = getPromptRenderMode(scriptFamily);
  const completionShare =
    promptText.length === 0 ? 0 : Math.min(1, typedText.length / Math.max(promptText.length, 1));
  const showStats = showStatTiles && presentationMode !== "minimal";
  const desktopCaptureEnabled = inputMode === "hardware";
  const readyStateMessage =
    typedText.length === 0
      ? inputMode === "touch"
        ? "Tap the field to bring up the keyboard. Timing starts on the first committed character."
        : "Start typing immediately. Timing starts on the first committed character. Switching apps resets the session to protect the benchmark or lesson."
      : "The highlighted character is the next target in the prompt. Keep the rhythm smooth instead of rushing the cursor.";

  const focusCaptureInput = useCallback(() => {
    if (!desktopCaptureEnabled || capturePaused) {
      return;
    }

    const captureInput = captureInputReference.current;

    if (!captureInput) {
      return;
    }

    window.requestAnimationFrame(() => {
      if (document.activeElement !== captureInput) {
        captureInput.focus({ preventScroll: true });
      }
    });
  }, [capturePaused, desktopCaptureEnabled]);

  useEffect(() => {
    latestInputValueReference.current = inputValue;
  }, [inputValue]);

  useEffect(() => {
    if (!desktopCaptureEnabled) {
      return;
    }

    if (capturePaused && document.activeElement === captureInputReference.current) {
      captureInputReference.current?.blur();
      return;
    }

    focusCaptureInput();
  }, [capturePaused, desktopCaptureEnabled, focusCaptureInput, promptText]);

  useEffect(() => {
    if (!desktopCaptureEnabled || capturePaused) {
      return;
    }

    function handleHardwareFallback(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.metaKey ||
        event.ctrlKey
      ) {
        return;
      }

      const activeElement = document.activeElement;

      if (
        activeElement === captureInputReference.current ||
        isEditableElement(activeElement)
      ) {
        return;
      }

      const nextValue = applyHardwareKey(
        latestInputValueReference.current,
        event.key,
        promptText.length,
      );

      if (nextValue === null) {
        return;
      }

      event.preventDefault();
      onTypedTextChange(nextValue);
      focusCaptureInput();
    }

    document.addEventListener("keydown", handleHardwareFallback, true);

    return () => {
      document.removeEventListener("keydown", handleHardwareFallback, true);
    };
  }, [capturePaused, desktopCaptureEnabled, focusCaptureInput, onTypedTextChange, promptText.length]);

  return (
    <div
      className={classNames("relative space-y-4", presentationMode === "minimal" && "space-y-3")}
      onPointerDownCapture={(event) => {
        if (
          !desktopCaptureEnabled ||
          capturePaused ||
          isEditableElement(event.target) ||
          isInteractiveControlElement(event.target)
        ) {
          return;
        }

        focusCaptureInput();
      }}
    >
      {showStats ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Net WPM" value={formatRate(sessionMetrics.netWpm)} accent="success" />
          <StatTile label="Gross WPM" value={formatRate(sessionMetrics.grossWpm)} />
          <StatTile label="Accuracy" value={formatPercent(sessionMetrics.accuracy)} />
          <StatTile
            label={remainingMs !== null ? "Time Left" : "Elapsed"}
            value={formatDuration(remainingMs ?? sessionMetrics.durationMs)}
            accent={remainingMs !== null && remainingMs < 15_000 ? "warn" : "default"}
          />
        </div>
      ) : null}

      <div
        className={classNames(
          "space-y-4",
          presentationMode === "minimal" && "space-y-3",
          promptWrapperClassName,
        )}
      >
        {headerSlot}
        {(showSessionControls || showReadyMessage) ? (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="max-w-3xl text-sm leading-6 text-textMuted">
              {imeProfile !== "direct"
                ? "Composition-aware input waits for committed IME text before advancing the prompt."
                : inputMode === "touch"
                  ? "Touch input keeps the prompt above the virtual keyboard and waits for committed text."
                  : "Hardware input tracks live timing against the visible lesson prompt."}
            </p>
            {showSessionControls ? (
              <div className="flex gap-2">
                <ActionButton tone="secondary" onClick={onRestart}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Restart
                </ActionButton>
                <ActionButton tone="ghost" onClick={onSkip}>
                  <SkipForward className="mr-2 h-4 w-4" />
                  Skip
                </ActionButton>
              </div>
            ) : null}
          </div>
        ) : null}

        {showProgressBar && (presentationMode !== "minimal" || remainingMs !== null) ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.22em] text-textMuted">
              <span>Prompt progress</span>
              <span>{Math.round(completionShare * 100)}%</span>
            </div>
            <div className="h-2 rounded-full bg-panelMuted">
              <div
                className="h-2 rounded-full bg-accent"
                style={{ width: `${Math.max(4, completionShare * 100)}%` }}
              />
            </div>
          </div>
        ) : null}

        {showReadyMessage && presentationMode !== "minimal" ? (
          <div className="border-y border-borderTone/45 px-1 py-3 text-sm leading-6 text-textMuted">
            {readyStateMessage}
          </div>
        ) : null}

        {desktopCaptureEnabled ? (
          <textarea
            ref={captureInputReference}
            value={inputValue}
            onChange={(event) => onTypedTextChange(event.target.value)}
            onCompositionStart={() => onCompositionStart()}
            onCompositionUpdate={(event) => onCompositionUpdate(event.currentTarget.value)}
            onCompositionEnd={(event) => onCompositionEnd(event.currentTarget.value)}
            lang={localeTag}
            dir={direction}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="done"
            tabIndex={-1}
            aria-label="Typing capture"
            data-testid="typing-capture-input"
            className="pointer-events-none absolute left-1/2 top-0 h-px w-px -translate-x-1/2 resize-none opacity-0"
          />
        ) : null}

        <div
          lang={localeTag}
          dir={direction}
          data-testid="prompt-board"
          data-language-id={languageId}
          data-script-family={scriptFamily}
          data-prompt-text={promptText}
          data-prompt-render-mode={promptRenderMode}
          className={classNames(
            "mx-auto max-w-[58rem] px-0 text-start text-[2.08rem] font-medium leading-[1.46] tracking-[0.008em] [unicode-bidi:plaintext] [text-wrap:pretty] sm:text-[2.42rem]",
            presentationMode !== "minimal" && "py-2",
            presentationMode === "compact" && "max-w-[60rem] text-[1.86rem] sm:text-[2.12rem]",
            presentationMode === "minimal" && "max-w-[62rem] py-6 text-[2.18rem] leading-[1.54] sm:text-[2.58rem]",
            promptRenderMode === "joined-script" &&
              "leading-[1.64] tracking-[0] [word-break:keep-all] sm:leading-[1.72]",
            scriptFamily === "hiragana" &&
              "font-sans leading-[1.68] tracking-[0.015em] [line-break:strict] [word-break:keep-all]",
            scriptFamily === "cyrillic" && "tracking-[-0.004em]",
            promptBoardClassName,
          )}
        >
          <PromptBoardContent
            promptText={promptText}
            typedText={typedText}
            whitespaceStyle={whitespaceStyle}
            direction={direction}
            scriptFamily={scriptFamily}
          />
        </div>
        {inputMode === "touch" ? (
          <div className="space-y-2" style={{ paddingBottom: keyboardInset }}>
            <label htmlFor="typing-input" className="text-sm font-semibold text-text">
              Type here
            </label>
            <textarea
              id="typing-input"
              value={inputValue}
              onChange={(event) => onTypedTextChange(event.target.value)}
              onCompositionStart={() => onCompositionStart()}
              onCompositionUpdate={(event) => onCompositionUpdate(event.currentTarget.value)}
              onCompositionEnd={(event) => onCompositionEnd(event.currentTarget.value)}
              lang={localeTag}
              dir={direction}
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              enterKeyHint="done"
              className="min-h-28 w-full rounded-xl border border-borderTone/70 bg-panel px-4 py-3 text-base text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
              placeholder="Tap here to begin typing..."
              aria-describedby={
                [statusMessage ? "typing-status" : null, warningMessage ? "typing-warning" : null]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
            />
            {statusMessage ? (
              <p id="typing-status" role="status" aria-live="polite" className="text-sm text-warn">
                {statusMessage}
              </p>
            ) : null}
            {warningMessage ? (
              <p
                id="typing-warning"
                data-testid="input-language-warning"
                role="status"
                aria-live="polite"
                className="rounded-xl border border-warn/35 bg-warn/10 px-3 py-2 text-sm leading-6 text-warn"
              >
                {warningMessage}
              </p>
            ) : null}
          </div>
        ) : null}
        {inputMode !== "touch" ? (
          <div className="space-y-2">
            {statusMessage ? (
              <p id="typing-status" role="status" aria-live="polite" className="text-sm text-warn">
                {statusMessage}
              </p>
            ) : null}
            {warningMessage ? (
              <p
                id="typing-warning"
                data-testid="input-language-warning"
                role="status"
                aria-live="polite"
                className="rounded-xl border border-warn/35 bg-warn/10 px-3 py-2 text-sm leading-6 text-warn"
              >
                {warningMessage}
              </p>
            ) : null}
          </div>
        ) : null}
        {footerSlot}
      </div>
    </div>
  );
}
