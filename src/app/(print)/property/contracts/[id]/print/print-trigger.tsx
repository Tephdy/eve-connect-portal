"use client";

import { useEffect } from "react";

/**
 * Fires window.print() once on mount so the user sees the browser's
 * "Save as PDF" flow immediately after the page renders.
 */
export function PrintTrigger() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return null;
}
