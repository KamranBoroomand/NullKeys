import {
  removeTrailingGrapheme,
  trimTextToCodeUnitLengthAtGraphemeBoundary,
} from "@/lib/text/language-text-normalization";

export const SPACE_SKIP_MARKER = "\u200b";

export function clampTypingValueToPromptLength(value: string, promptLength: number) {
  return trimTextToCodeUnitLengthAtGraphemeBoundary(value, promptLength);
}

export function removeTrailingTypingCluster(value: string) {
  return removeTrailingGrapheme(value);
}
