import { countTextGraphemes } from "@/lib/text/language-text-normalization";
import type { SessionInvalidReason } from "@/lib/scoring/session-validity";

export type TypingInputSource =
  | "typed-text"
  | "deletion"
  | "composition"
  | "paste"
  | "drop"
  | "autofill"
  | "replacement"
  | "history"
  | "unknown";

export interface TypingInputMetadata {
  inputType?: string;
  data?: string | null;
  eventTimestampMs?: number;
  isComposing?: boolean;
  sourceHint?: TypingInputSource;
}

export interface ClassifiedTypingInput extends TypingInputMetadata {
  source: TypingInputSource;
  timingAuthoritative: boolean;
  invalidReasons: SessionInvalidReason[];
}

function classifyInputType(inputType: string | undefined): TypingInputSource {
  if (!inputType) {
    return "unknown";
  }

  if (inputType.startsWith("delete")) {
    return "deletion";
  }

  if (inputType === "insertText" || inputType === "insertLineBreak") {
    return "typed-text";
  }

  if (inputType.includes("Composition")) {
    return "composition";
  }

  if (inputType === "insertFromPaste" || inputType === "insertFromYank") {
    return "paste";
  }

  if (inputType === "insertFromDrop") {
    return "drop";
  }

  if (/autofill/i.test(inputType)) {
    return "autofill";
  }

  if (inputType === "insertReplacementText") {
    return "replacement";
  }

  if (inputType === "historyUndo" || inputType === "historyRedo") {
    return "history";
  }

  return "unknown";
}

export function classifyTypingInput(
  metadata: TypingInputMetadata,
  appendedText: string,
): ClassifiedTypingInput {
  const source = metadata.sourceHint ?? classifyInputType(metadata.inputType);
  const invalidReasons: SessionInvalidReason[] = [];
  const appendedGraphemeCount = countTextGraphemes(appendedText);

  if (source === "paste") {
    invalidReasons.push("pasted-text");
  } else if (source === "drop") {
    invalidReasons.push("dropped-text");
  } else if (source === "autofill") {
    invalidReasons.push("autofill");
  } else if (source === "replacement") {
    invalidReasons.push("replacement-input");
  } else if (source === "history") {
    invalidReasons.push("undo-redo");
  } else if (source === "unknown" && appendedGraphemeCount > 0) {
    invalidReasons.push("unknown-input");
  }

  if (
    appendedGraphemeCount > 1 &&
    source !== "composition" &&
    source !== "paste" &&
    source !== "drop" &&
    source !== "autofill" &&
    source !== "replacement"
  ) {
    invalidReasons.push("suspicious-multi-grapheme-input");
  }

  return {
    ...metadata,
    source,
    timingAuthoritative:
      appendedGraphemeCount <= 1 &&
      (source === "typed-text" || source === "deletion"),
    invalidReasons: Array.from(new Set(invalidReasons)),
  };
}
