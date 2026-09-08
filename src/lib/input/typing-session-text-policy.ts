import { clampTypingValueToPromptLength, SPACE_SKIP_MARKER } from "@/lib/input/typing-markers";
import {
  countTextGraphemes,
  findSharedGraphemePrefixLength,
  splitTextIntoGraphemes,
} from "@/lib/text/language-text-normalization";

function findCurrentWordBoundary(promptGraphemes: string[], fromIndex: number) {
  let currentIndex = fromIndex;
  while (currentIndex < promptGraphemes.length && promptGraphemes[currentIndex] !== " ") {
    currentIndex += 1;
  }
  return currentIndex;
}

export function expandIncomingTypingValue(
  incomingValue: string,
  typedText: string,
  promptText: string,
  spaceSkipsWords: boolean,
) {
  const promptGraphemes = splitTextIntoGraphemes(promptText);
  const normalizedIncomingValue = clampTypingValueToPromptLength(
    incomingValue.replace(/\r/g, ""),
    promptGraphemes.length,
  );
  const incomingGraphemes = splitTextIntoGraphemes(normalizedIncomingValue);
  const typedGraphemes = splitTextIntoGraphemes(typedText);
  const sharedPrefixLength = findSharedGraphemePrefixLength(
    typedGraphemes.join(""),
    incomingGraphemes.join(""),
  );
  const rebuiltGraphemes = incomingGraphemes.slice(0, sharedPrefixLength);

  for (const enteredCharacter of incomingGraphemes.slice(sharedPrefixLength)) {
    const promptIndex = rebuiltGraphemes.length;
    const expectedCharacter = promptGraphemes[promptIndex];
    if (
      spaceSkipsWords &&
      enteredCharacter === " " &&
      expectedCharacter !== undefined &&
      expectedCharacter !== " "
    ) {
      const wordBoundaryIndex = findCurrentWordBoundary(promptGraphemes, promptIndex);
      rebuiltGraphemes.push(
        ...Array.from(
          { length: Math.max(0, wordBoundaryIndex - promptIndex) },
          () => SPACE_SKIP_MARKER,
        ),
      );
      if (wordBoundaryIndex < promptGraphemes.length) {
        rebuiltGraphemes.push(promptGraphemes[wordBoundaryIndex] ?? "");
      }
      continue;
    }
    rebuiltGraphemes.push(enteredCharacter);
  }

  return clampTypingValueToPromptLength(rebuiltGraphemes.join(""), promptGraphemes.length);
}

export function isTypingPromptComplete(promptText: string, typedText: string) {
  return countTextGraphemes(typedText) >= countTextGraphemes(promptText);
}
