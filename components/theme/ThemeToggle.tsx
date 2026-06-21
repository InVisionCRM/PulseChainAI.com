"use client";

import { useEffect, useState } from "react";
import { IconMoon, IconSun } from "@tabler/icons-react";

/**
 * Theme toggle button. Lives in the desktop side-rail (`variant="rail"`) and the
 * mobile bottom bar (`variant="bar"`). It only *requests* a toggle by dispatching
 * a `pc-theme-toggle` event — the single <PullChainOverlay> plays the animation
 * and flips the theme, then emits `pc-theme-changed` so the icon stays in sync.
 */
export function ThemeToggle({ variant = "rail" }: { variant?: "rail" | "bar" }) {
  // default matches the pre-paint default (dark) so SSR/CSR first render agree
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const sync = () => setIsDark(document.documentElement.classList.contains("dark"));
    sync();
    window.addEventListener("pc-theme-changed", sync);
    return () => window.removeEventListener("pc-theme-changed", sync);
  }, []);

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    window.dispatchEvent(
      new CustomEvent("pc-theme-toggle", { detail: { x: e.clientX, y: e.clientY } }),
    );
  };

  const Icon = isDark ? IconMoon : IconSun;
  const shared = {
    type: "button" as const,
    onClick,
    "aria-label": "Toggle light or dark theme",
    "aria-pressed": !isDark,
  };

  if (variant === "bar") {
    return (
      <button
        {...shared}
        className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
      >
        <Icon className="h-5 w-5" />
        <span className="text-xs font-medium">Theme</span>
      </button>
    );
  }

  return (
    <button
      {...shared}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 transition-colors text-[var(--text)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="text-xs md:text-sm whitespace-pre inline-block text-[var(--text)]">Theme</span>
    </button>
  );
}
