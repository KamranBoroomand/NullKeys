export const TYPING_SESSION_ACTIVITY_EVENT = "nullkeys-typing-session-activity";

const activeSessionIds = new Set<string>();

export function setTypingSessionActivity(sessionId: string, active: boolean) {
  if (!sessionId) return;
  if (active) activeSessionIds.add(sessionId);
  else activeSessionIds.delete(sessionId);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(TYPING_SESSION_ACTIVITY_EVENT));
  }
}

export function hasActiveTypingSession() {
  return activeSessionIds.size > 0;
}

export function resetTypingSessionActivityForTests() {
  activeSessionIds.clear();
}
