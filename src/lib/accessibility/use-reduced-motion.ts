"use client";

import { useEffect, useState } from "react";

export function useReducedMotionPreference() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQueryList = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyChange = () => setReducedMotion(mediaQueryList.matches);

    applyChange();
    mediaQueryList.addEventListener("change", applyChange);

    return () => {
      mediaQueryList.removeEventListener("change", applyChange);
    };
  }, []);

  return reducedMotion;
}

