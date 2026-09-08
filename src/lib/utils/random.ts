export function chooseRandomItem<T>(items: readonly T[], seedIndex?: number) {
  if (items.length === 0) {
    throw new Error("Cannot choose from an empty collection.");
  }

  if (typeof seedIndex === "number") {
    return items[Math.abs(seedIndex) % items.length];
  }

  return items[Math.floor(Math.random() * items.length)];
}

export function shuffleItems<T>(items: readonly T[]) {
  const clone = [...items];

  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
  }

  return clone;
}

export function sampleItems<T>(items: readonly T[], count: number) {
  return shuffleItems(items).slice(0, Math.max(0, count));
}

export function pickWeightedItem<T>(pairs: ReadonlyArray<{ item: T; weight: number }>) {
  const positivePairs = pairs.filter((pair) => pair.weight > 0);
  const totalWeight = positivePairs.reduce((sum, pair) => sum + pair.weight, 0);

  if (totalWeight === 0) {
    return chooseRandomItem(positivePairs.map((pair) => pair.item));
  }

  let threshold = Math.random() * totalWeight;

  for (const pair of positivePairs) {
    threshold -= pair.weight;
    if (threshold <= 0) {
      return pair.item;
    }
  }

  return positivePairs[positivePairs.length - 1].item;
}
