"use client";

import { useEffect, useState } from "react";

export function useDepressedKeys() {
  const [depressedKeyCodes, setDepressedKeyCodes] = useState<string[]>([]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      setDepressedKeyCodes((existingCodes) =>
        existingCodes.includes(event.code) ? existingCodes : [...existingCodes, event.code],
      );
    }

    function handleKeyUp(event: KeyboardEvent) {
      setDepressedKeyCodes((existingCodes) =>
        existingCodes.filter((existingCode) => existingCode !== event.code),
      );
    }

    function clearKeys() {
      setDepressedKeyCodes([]);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearKeys);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearKeys);
    };
  }, []);

  return depressedKeyCodes;
}

