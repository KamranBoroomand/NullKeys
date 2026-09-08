import { createSessionId } from "@/lib/persistence/session-id";

describe("session identifier generation", () => {
  it("creates collision-resistant UUID-shaped identifiers", () => {
    const identifiers = new Set(Array.from({ length: 128 }, () => createSessionId()));

    expect(identifiers.size).toBe(128);
    for (const identifier of identifiers) {
      expect(identifier).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
      );
    }
  });
});
