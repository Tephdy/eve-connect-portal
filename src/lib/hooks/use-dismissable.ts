"use client";

import { useEffect, useRef } from "react";

export function useDismissable({
  active,
  onDismiss,
  lockScroll = false,
}: {
  active: boolean;
  onDismiss: () => void;
  lockScroll?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onDismiss();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, onDismiss]);

  useEffect(() => {
    if (!active) return;

    function onPointerDown(e: PointerEvent | MouseEvent | TouchEvent) {
      const el = ref.current;
      if (!el) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (!el.contains(target)) {
        onDismiss();
      }
    }

    const usePointer =
      typeof window !== "undefined" && "PointerEvent" in window;
    if (usePointer) {
      document.addEventListener("pointerdown", onPointerDown, true);
      return () =>
        document.removeEventListener("pointerdown", onPointerDown, true);
    } else {
      document.addEventListener("mousedown", onPointerDown, true);
      document.addEventListener("touchstart", onPointerDown, true);
      return () => {
        document.removeEventListener("mousedown", onPointerDown, true);
        document.removeEventListener("touchstart", onPointerDown, true);
      };
    }
  }, [active, onDismiss]);

  useEffect(() => {
    if (!active || !lockScroll) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [active, lockScroll]);

  return ref;
}
