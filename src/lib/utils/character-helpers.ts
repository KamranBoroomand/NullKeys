const SPACE_LABEL = "space";

export function normalizeCharacterForLabel(character: string) {
  if (character === " ") {
    return SPACE_LABEL;
  }

  if (character === "\n") {
    return "return";
  }

  if (character === "\t") {
    return "tab";
  }

  return character;
}

export function uniqueCharacters(text: string) {
  return Array.from(new Set(Array.from(text)));
}

export function containsAnyCharacter(text: string, characters: string[]) {
  return characters.some((character) => text.includes(character));
}

