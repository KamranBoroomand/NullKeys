export function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function formatRate(value: number) {
  return value.toFixed(1);
}

export function formatDuration(milliseconds: number) {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutesPortion = Math.floor(seconds / 60);
  const secondsPortion = seconds % 60;

  return `${minutesPortion}:${secondsPortion.toString().padStart(2, "0")}`;
}

export function formatRelativeSessionDate(isoString: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoString));
}

