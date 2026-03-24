"use client";

import { useEffect, useCallback, useRef } from "react";

/**
 * Lightweight global keyboard shortcut hook.
 *
 * Listens for a key with Cmd (Mac) or Ctrl (other platforms).
 * Calls `callback` and prevents the browser default.
 */
export function useHotkey(
  key: string,
  callback: () => void,
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      // Ignore if user is typing in an input/textarea (except our search box)
      const target = e.target as HTMLElement;
      if (
        target.tagName === "TEXTAREA" ||
        (target.tagName === "INPUT" && target.getAttribute("aria-label") !== "Search secrets") ||
        target.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
      callbackRef.current();
    },
    [key],
  );

  useEffect(() => {
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handler]);
}
