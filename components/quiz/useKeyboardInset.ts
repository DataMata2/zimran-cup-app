"use client";

import { useSyncExternalStore } from "react";

// How much of the bottom of the layout viewport the on-screen keyboard covers, in px.
// iOS Safari keeps the layout viewport when the keyboard opens, so a `position: fixed; bottom: 0` bar
// would sit behind the keyboard; lifting it by this inset keeps Continue in sight. Android Chrome with
// `interactive-widget=resizes-content` (set on /start) shrinks the layout viewport instead, so this is 0.

function subscribe(onChange: () => void): () => void {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  vv.addEventListener("resize", onChange);
  vv.addEventListener("scroll", onChange);
  window.addEventListener("resize", onChange);
  return () => {
    vv.removeEventListener("resize", onChange);
    vv.removeEventListener("scroll", onChange);
    window.removeEventListener("resize", onChange);
  };
}

function snapshot(): number {
  const vv = window.visualViewport;
  if (!vv) return 0;
  const covered = window.innerHeight - vv.height - vv.offsetTop;
  // Ignore sub-pixel noise and browser-chrome jitter; a keyboard is far taller than this.
  return covered > 40 ? Math.round(covered) : 0;
}

export function useKeyboardInset(): number {
  return useSyncExternalStore(subscribe, snapshot, () => 0);
}
