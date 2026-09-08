function formatUuidBytes(bytes: Uint8Array) {
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hexadecimal = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));

  return [
    hexadecimal.slice(0, 4).join(""),
    hexadecimal.slice(4, 6).join(""),
    hexadecimal.slice(6, 8).join(""),
    hexadecimal.slice(8, 10).join(""),
    hexadecimal.slice(10, 16).join(""),
  ].join("-");
}

export function createSessionId() {
  if (typeof crypto === "undefined") {
    throw new Error("This browser cannot create a collision-resistant session identifier.");
  }

  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  if (typeof crypto.getRandomValues === "function") {
    return formatUuidBytes(crypto.getRandomValues(new Uint8Array(16)));
  }

  throw new Error("This browser cannot create a collision-resistant session identifier.");
}
