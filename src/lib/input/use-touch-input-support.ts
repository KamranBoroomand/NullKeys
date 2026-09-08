"use client";

import { useEffect, useState } from "react";

export function useTouchInputSupport() {
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    if (!window.visualViewport) {
      return;
    }

    const handleResize = () => {
      const viewportGap = window.innerHeight - window.visualViewport!.height;
      setKeyboardInset(Math.max(0, Math.round(viewportGap)));
    };

    handleResize();
    window.visualViewport.addEventListener("resize", handleResize);

    return () => {
      window.visualViewport?.removeEventListener("resize", handleResize);
    };
  }, []);

  return {
    keyboardInset,
    prefersTouch:
      typeof window !== "undefined" &&
      (window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0),
  };
}

