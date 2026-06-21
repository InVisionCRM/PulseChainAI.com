"use client";

import { useEffect, useRef } from "react";
import styles from "./PullChainOverlay.module.css";

/**
 * Single, app-wide theme transition. Mounted once in the root layout.
 *
 * Any ThemeToggle dispatches a `pc-theme-toggle` window event; this overlay
 * plays the pull-chain animation and flips the `.dark` class on <html> at the
 * bottom of the pull (the same mechanism globals.css already uses:
 * `@custom-variant dark (&:is(.dark *))`). The choice is persisted to
 * localStorage('pc-theme'). With reduced motion, it flips instantly.
 *
 * After flipping, it emits `pc-theme-changed` so toggles can update their icon.
 */
const FLIP_AT = 620; // ms — when the chain reaches the bottom of the pull
const END_AT = 1200; // ms — when the arm has retracted off-screen

export const THEME_STORAGE_KEY = "pc-theme";

function currentTheme(): "light" | "dark" {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function setTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* storage may be unavailable (private mode) — still flips for this session */
  }
  window.dispatchEvent(new CustomEvent("pc-theme-changed", { detail: { theme } }));
}

export function PullChainOverlay() {
  const stageRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const flip = () => setTheme(currentTheme() === "dark" ? "light" : "dark");

    const onToggle = () => {
      if (reduce) {
        flip();
        return;
      }
      const stage = stageRef.current;
      if (!stage || busyRef.current) return;
      busyRef.current = true;

      // restart the CSS animation
      stage.classList.remove(styles.running);
      void stage.offsetWidth; // force reflow
      stage.classList.add(styles.running);

      window.setTimeout(flip, FLIP_AT);
      window.setTimeout(() => {
        stage.classList.remove(styles.running);
        busyRef.current = false;
      }, END_AT);
    };

    window.addEventListener("pc-theme-toggle", onToggle);
    return () => window.removeEventListener("pc-theme-toggle", onToggle);
  }, []);

  return (
    <div ref={stageRef} className={styles.stage} aria-hidden="true">
      <div className={styles.chainRig}>
        <div className={styles.chainCol} />
        <div className={styles.chainBall} />
      </div>
      <div className={styles.armAnim}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.armImg} src="/pull-arm.png" alt="" draggable={false} />
      </div>
    </div>
  );
}
