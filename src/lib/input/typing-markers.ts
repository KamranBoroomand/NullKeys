import {
  removeTrailingGrapheme,
  trimTextToGraphemeCount,
} from "@/lib/text/language-text-normalization";

export const SPACE_SKIP_MARKER = "\u200b";

export function clampTypingValueToPromptLength(value: string, promptGraphemeCount: number) {
  return trimTextToGraphemeCount(value, promptGraphemeCount);
}

export function removeTrailingTypingCluster(value: string) {
  return removeTrailingGrapheme(value);
}
