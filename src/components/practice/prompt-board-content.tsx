"use client";

import { Fragment, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ScriptFamily } from "@/content/languages/language-text-metadata";
import type { WhitespaceStyle } from "@/features/user-preferences/preferences-schema";
import { segmentTextIntoGraphemes } from "@/lib/text/language-text-normalization";
import { classNames } from "@/lib/utils/class-names";

export type PromptRenderMode = "character" | "joined-script";

interface PromptBoardContentProps {
  promptText: string;
  typedText?: string;
  completedCount?: number;
  whitespaceStyle: WhitespaceStyle;
  direction: "ltr" | "rtl";
  scriptFamily: ScriptFamily;
}

interface PromptDisplayChunk {
  kind: "text" | "space";
  text: string;
  start: number;
  end: number;
}

type JoinedScriptCharacterState = "correct" | "danger" | "current" | "pending";

interface JoinedScriptCharacter {
  text: string;
  start: number;
  end: number;
}

interface JoinedScriptSegment {
  text: string;
  start: number;
  end: number;
  state: JoinedScriptCharacterState;
}

interface JoinedScriptOverlaySegment extends JoinedScriptSegment {
  clipPath: string;
  underlineStyle?: CSSProperties;
}

function renderPromptWhitespace(
  promptCharacter: string,
  whitespaceStyle: WhitespaceStyle,
  direction: "ltr" | "rtl",
  tone: "default" | "muted" | "current" | "danger" = "default",
) {
  if (promptCharacter !== " ") {
    return promptCharacter;
  }

  const markerToneClassName =
    tone === "danger"
      ? "text-danger"
      : tone === "current"
        ? "text-accent"
        : tone === "muted"
          ? "text-textMuted/60"
          : "text-textMuted/75";

  if (whitespaceStyle === "bar") {
    return (
      <span
        aria-hidden="true"
        dir="ltr"
        className={classNames(
          "inline-flex min-w-[0.52em] items-center justify-center align-baseline [unicode-bidi:isolate]",
          markerToneClassName,
          direction === "rtl" && "min-w-[0.58em] text-[0.92em]",
        )}
      >
        |
      </span>
    );
  }

  if (whitespaceStyle === "bullet") {
    return (
      <span
        aria-hidden="true"
        className={classNames(
          "inline-flex min-w-[0.52em] items-center justify-center align-baseline [unicode-bidi:isolate]",
          markerToneClassName,
        )}
      >
        ·
      </span>
    );
  }

  return <span className="inline-block min-w-[0.38em] align-baseline">{"\u00a0"}</span>;
}

export function getPromptRenderMode(scriptFamily: ScriptFamily): PromptRenderMode {
  return scriptFamily === "arabic" ? "joined-script" : "character";
}

function buildJoinedScriptChunks(promptText: string) {
  const chunks: PromptDisplayChunk[] = [];
  const matcher = / +|[^ ]+/gu;

  for (const match of promptText.matchAll(matcher)) {
    const chunkText = match[0] ?? "";
    const start = match.index ?? 0;
    const end = start + chunkText.length;

    chunks.push({
      kind: /^\s+$/u.test(chunkText) ? "space" : "text",
      text: chunkText,
      start,
      end,
    });
  }

  return chunks;
}

function getChunkMismatch(chunk: PromptDisplayChunk, typedText: string | undefined) {
  if (!typedText) {
    return false;
  }

  for (const character of buildJoinedScriptCharacters(chunk)) {
    if (typedText.length <= character.start) {
      break;
    }

    if (typedText.slice(character.start, Math.min(character.end, typedText.length)) !== character.text) {
      return true;
    }
  }

  return false;
}

function buildJoinedScriptCharacters(chunk: PromptDisplayChunk) {
  return segmentTextIntoGraphemes(chunk.text).map((grapheme) => ({
    text: grapheme.text,
    start: chunk.start + grapheme.start,
    end: chunk.start + grapheme.end,
  }));
}

function getJoinedScriptCharacterState(
  character: JoinedScriptCharacter,
  typedText: string | undefined,
  currentIndex: number,
): JoinedScriptCharacterState {
  if (typedText !== undefined) {
    if (currentIndex >= character.end) {
      return typedText.slice(character.start, character.end) === character.text ? "correct" : "danger";
    }

    return currentIndex >= character.start && currentIndex < character.end ? "current" : "pending";
  }

  if (currentIndex >= character.end) {
    return "correct";
  }

  return currentIndex >= character.start && currentIndex < character.end ? "current" : "pending";
}

function buildJoinedScriptSegments(
  chunk: PromptDisplayChunk,
  typedText: string | undefined,
  currentIndex: number,
) {
  const segments: JoinedScriptSegment[] = [];

  for (const character of buildJoinedScriptCharacters(chunk)) {
    const state = getJoinedScriptCharacterState(character, typedText, currentIndex);
    const lastSegment = segments[segments.length - 1];
    const shouldIsolateCharacter = state === "danger" || state === "current";

    if (
      lastSegment &&
      !shouldIsolateCharacter &&
      lastSegment.state === state &&
      lastSegment.end === character.start
    ) {
      lastSegment.text += character.text;
      lastSegment.end = character.end;
      continue;
    }

    segments.push({
      text: character.text,
      start: character.start,
      end: character.end,
      state,
    });
  }

  return segments;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function measureJoinedScriptSegmentRect(range: Range) {
  const clientRects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0);

  if (clientRects.length === 0) {
    const fallbackRect = range.getBoundingClientRect();
    return fallbackRect.width > 0 ? fallbackRect : null;
  }

  const left = Math.min(...clientRects.map((rect) => rect.left));
  const right = Math.max(...clientRects.map((rect) => rect.right));
  const top = Math.min(...clientRects.map((rect) => rect.top));
  const bottom = Math.max(...clientRects.map((rect) => rect.bottom));

  return {
    left,
    right,
    top,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
    x: left,
    y: top,
    toJSON: () => ({
      left,
      right,
      top,
      bottom,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
      x: left,
      y: top,
    }),
  } satisfies DOMRect;
}

function buildApproximateJoinedScriptOverlaySegment(
  chunk: PromptDisplayChunk,
  segment: JoinedScriptSegment,
  direction: "ltr" | "rtl",
): JoinedScriptOverlaySegment {
  const characters = buildJoinedScriptCharacters(chunk);
  const totalCharacterCount = Math.max(characters.length, 1);
  const startCharacterIndex = characters.findIndex((character) => character.start === segment.start);
  const endCharacterIndex = characters.findIndex((character) => character.end === segment.end);
  const logicalStart =
    (startCharacterIndex >= 0 ? startCharacterIndex : 0) / totalCharacterCount;
  const logicalEnd =
    (endCharacterIndex >= 0 ? endCharacterIndex + 1 : totalCharacterCount) / totalCharacterCount;
  const leftRatio = direction === "rtl" ? 1 - logicalEnd : logicalStart;
  const rightRatio = direction === "rtl" ? logicalStart : 1 - logicalEnd;
  const widthRatio = Math.max(logicalEnd - logicalStart, 1 / totalCharacterCount);

  return {
    ...segment,
    clipPath: `inset(0 ${rightRatio * 100}% 0 ${leftRatio * 100}%)`,
    underlineStyle:
      segment.state === "current"
        ? {
            left: `${leftRatio * 100}%`,
            width: `${widthRatio * 100}%`,
          }
        : undefined,
  };
}

function measureJoinedScriptOverlaySegment(options: {
  chunk: PromptDisplayChunk;
  segment: JoinedScriptSegment;
  direction: "ltr" | "rtl";
  wordElement: HTMLSpanElement | null;
}) {
  const fallbackSegment = buildApproximateJoinedScriptOverlaySegment(
    options.chunk,
    options.segment,
    options.direction,
  );

  if (!options.wordElement) {
    return fallbackSegment;
  }

  const textNode = options.wordElement.firstChild;
  const baseRect = options.wordElement.getBoundingClientRect();

  if (!(textNode instanceof Text) || baseRect.width <= 0 || typeof document.createRange !== "function") {
    return fallbackSegment;
  }

  try {
    const range = document.createRange();
    range.setStart(textNode, options.segment.start - options.chunk.start);
    range.setEnd(textNode, options.segment.end - options.chunk.start);
    const segmentRect = measureJoinedScriptSegmentRect(range);

    if (!segmentRect || segmentRect.width <= 0) {
      return fallbackSegment;
    }

    const left = clamp(segmentRect.left - baseRect.left, 0, baseRect.width);
    const right = clamp(baseRect.right - segmentRect.right, 0, baseRect.width);
    const width = Math.max(baseRect.width - left - right, 1);

    return {
      ...options.segment,
      clipPath: `inset(0 ${right}px 0 ${left}px)`,
      underlineStyle:
        options.segment.state === "current"
          ? {
              left: `${left}px`,
              width: `${width}px`,
            }
          : undefined,
    };
  } catch {
    return fallbackSegment;
  }
}

function JoinedScriptWord({
  chunk,
  typedText,
  currentIndex,
  direction,
}: {
  chunk: PromptDisplayChunk;
  typedText: string | undefined;
  currentIndex: number;
  direction: "ltr" | "rtl";
}) {
  const wordReference = useRef<HTMLSpanElement | null>(null);
  const segments = useMemo(
    () =>
      buildJoinedScriptSegments(chunk, typedText, currentIndex).filter(
        (segment) => segment.state !== "pending",
      ),
    [chunk, currentIndex, typedText],
  );
  const [overlaySegments, setOverlaySegments] = useState<JoinedScriptOverlaySegment[]>(() =>
    segments.map((segment) =>
      buildApproximateJoinedScriptOverlaySegment(chunk, segment, direction),
    ),
  );

  useLayoutEffect(() => {
    const updateSegments = () => {
      setOverlaySegments(
        segments.map((segment) =>
          measureJoinedScriptOverlaySegment({
            chunk,
            segment,
            direction,
            wordElement: wordReference.current,
          }),
        ),
      );
    };

    updateSegments();

    const resizeObserver =
      typeof ResizeObserver !== "undefined" && wordReference.current
        ? new ResizeObserver(() => updateSegments())
        : null;

    if (resizeObserver && wordReference.current) {
      resizeObserver.observe(wordReference.current);
    }

    const handleWindowResize = () => updateSegments();
    window.addEventListener("resize", handleWindowResize);
    void document.fonts?.ready.then(() => updateSegments()).catch(() => undefined);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [chunk, direction, segments]);

  return (
    <span
      data-joined-script-word="true"
      className="relative inline-block align-baseline [unicode-bidi:plaintext]"
    >
      <span
        ref={wordReference}
        data-joined-script-base="true"
        className="inline rounded-[3px] px-[1px] text-textMuted/85"
      >
        {chunk.text}
      </span>
      {overlaySegments.map((segment, segmentIndex) => (
        <Fragment key={`overlay-${chunk.start}-${segment.start}-${segmentIndex}`}>
          <span
            aria-hidden="true"
            data-prompt-start={segment.start}
            data-prompt-end={segment.end}
            data-prompt-state={segment.state}
            className={classNames(
              "pointer-events-none absolute inset-0 overflow-hidden [unicode-bidi:plaintext]",
              segment.state === "correct" && "text-text",
              segment.state === "danger" && "text-danger",
              segment.state === "current" && "text-text",
            )}
            style={{ clipPath: segment.clipPath }}
          >
            <span className="inline rounded-[3px] px-[1px] whitespace-pre">{chunk.text}</span>
          </span>
          {segment.state === "current" && segment.underlineStyle ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 h-[2px] rounded-full bg-accent"
              style={segment.underlineStyle}
            />
          ) : null}
        </Fragment>
      ))}
    </span>
  );
}

function renderJoinedScriptContent({
  promptText,
  typedText,
  completedCount,
  whitespaceStyle,
  direction,
}: Omit<PromptBoardContentProps, "scriptFamily">) {
  const currentIndex = typedText !== undefined ? typedText.length : completedCount ?? 0;

  return buildJoinedScriptChunks(promptText).map((chunk, chunkIndex) => {
    const hasTyped = currentIndex > chunk.start;
    const fullyTyped = currentIndex >= chunk.end;
    const isCurrent = currentIndex >= chunk.start && currentIndex < chunk.end;
    const hasMismatch = getChunkMismatch(chunk, typedText);

    if (chunk.kind === "space") {
      return (
        <Fragment key={`space-${chunkIndex}-${chunk.start}`}>
          {Array.from(chunk.text).map((spaceCharacter, spaceIndex) => {
            const isCurrentSpace = isCurrent && spaceIndex === 0;
            const isTypedSpace = hasTyped || fullyTyped;
            const tone =
              hasMismatch
                ? "danger"
                : isCurrentSpace
                  ? "current"
                  : !isTypedSpace
                    ? "muted"
                    : "default";

            return (
              <span
                key={`space-${chunk.start}-${spaceIndex}`}
                data-joined-script-space="true"
                className={classNames(
                  "inline rounded-[3px] px-[1px] [unicode-bidi:isolate]",
                  direction === "rtl" && whitespaceStyle !== "none" && "mx-[0.08em]",
                  hasMismatch && "text-danger",
                  isCurrentSpace && "border-b-2 border-accent",
                )}
              >
                {renderPromptWhitespace(spaceCharacter, whitespaceStyle, direction, tone)}
              </span>
            );
          })}
        </Fragment>
      );
    }

    return (
      <JoinedScriptWord
        key={`text-${chunkIndex}-${chunk.start}`}
        chunk={chunk}
        typedText={typedText}
        currentIndex={currentIndex}
        direction={direction}
      />
    );
  });
}

function renderCharacterContent({
  promptText,
  typedText,
  completedCount,
  whitespaceStyle,
  direction,
}: Omit<PromptBoardContentProps, "scriptFamily">) {
  const committedText = typedText ?? "";
  const activeCount = committedText.length > 0 ? committedText.length : completedCount ?? 0;
  const chunks = buildJoinedScriptChunks(promptText);

  return chunks.map((chunk, chunkIndex) => {
    if (chunk.kind === "space") {
      return (
        <Fragment key={`space-${chunk.start}-${chunkIndex}`}>
          {Array.from(chunk.text).map((spaceCharacter, spaceIndex) => {
            const start = chunk.start + spaceIndex;
            const end = start + 1;
            const fullyTyped =
              typedText !== undefined ? committedText.length >= end : activeCount >= end;
            const partiallyTyped =
              typedText !== undefined
                ? committedText.length > start && committedText.length < end
                : activeCount > start && activeCount < end;
            const wasTyped =
              typedText !== undefined ? committedText.length > start : activeCount > start;
            const correct =
              typedText !== undefined
                ? fullyTyped && committedText.slice(start, Math.min(end, committedText.length)) === spaceCharacter
                : fullyTyped;
            const isCurrent =
              typedText !== undefined
                ? committedText.length >= start && committedText.length < end
                : activeCount >= start && activeCount < end;
            const whitespaceTone =
              fullyTyped && !correct
                ? "danger"
                : isCurrent || partiallyTyped
                  ? "current"
                  : !wasTyped
                    ? "muted"
                    : "default";

            return (
              <span
                key={`space-${start}-${spaceIndex}`}
                className={classNames(
                  "inline rounded-[3px] px-[1px]",
                  fullyTyped && correct && "text-text",
                  fullyTyped && !correct && "text-danger",
                  isCurrent && "border-b-2 border-accent text-text",
                  !wasTyped && !isCurrent && "text-textMuted/85",
                )}
              >
                {renderPromptWhitespace(spaceCharacter, whitespaceStyle, direction, whitespaceTone)}
              </span>
            );
          })}
        </Fragment>
      );
    }

    return (
      <span key={`word-${chunk.start}-${chunkIndex}`} className="inline-block max-w-full align-baseline">
        {segmentTextIntoGraphemes(chunk.text).map((promptCharacter) => {
          const start = chunk.start + promptCharacter.start;
          const end = chunk.start + promptCharacter.end;
          const fullyTyped =
            typedText !== undefined ? committedText.length >= end : activeCount >= end;
          const partiallyTyped =
            typedText !== undefined
              ? committedText.length > start && committedText.length < end
              : activeCount > start && activeCount < end;
          const wasTyped =
            typedText !== undefined ? committedText.length > start : activeCount > start;
          const correct =
            typedText !== undefined
              ? fullyTyped &&
                committedText.slice(start, Math.min(end, committedText.length)) === promptCharacter.text
              : fullyTyped;
          const isCurrent =
            typedText !== undefined
              ? committedText.length >= start && committedText.length < end
              : activeCount >= start && activeCount < end;
          const whitespaceTone =
            fullyTyped && !correct
              ? "danger"
              : isCurrent || partiallyTyped
                ? "current"
                : !wasTyped
                  ? "muted"
                  : "default";

          return (
            <span
              key={`${start}-${end}-${promptCharacter.text}`}
              className={classNames(
                "inline rounded-[3px] px-[1px]",
                fullyTyped && correct && "text-text",
                fullyTyped && !correct && "text-danger",
                isCurrent && "border-b-2 border-accent text-text",
                !wasTyped && !isCurrent && "text-textMuted/85",
              )}
            >
              {renderPromptWhitespace(promptCharacter.text, whitespaceStyle, direction, whitespaceTone)}
            </span>
          );
        })}
      </span>
    );
  });
}

export function PromptBoardContent({
  promptText,
  typedText,
  completedCount,
  whitespaceStyle,
  direction,
  scriptFamily,
}: PromptBoardContentProps) {
  const renderMode = getPromptRenderMode(scriptFamily);

  return renderMode === "joined-script"
    ? renderJoinedScriptContent({
        promptText,
        typedText,
        completedCount,
        whitespaceStyle,
        direction,
      })
    : renderCharacterContent({
        promptText,
        typedText,
        completedCount,
        whitespaceStyle,
        direction,
      });
}
