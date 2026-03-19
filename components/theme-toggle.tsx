"use client";

import { useState, useEffect } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

/**
 * 3-state theme toggle: system → light → dark → system.
 * Matches the basalt/zhe design system pattern.
 */
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const cycle = () => {
    if (theme === "system") setTheme("light");
    else if (theme === "light") setTheme("dark");
    else setTheme("system");
  };

  // SSR fallback — render a static Sun icon to avoid hydration mismatch
  if (!mounted) {
    return (
      <button
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors"
        aria-label="Toggle theme"
      >
        <Sun className="h-4 w-4" strokeWidth={1.5} />
      </button>
    );
  }

  const Icon =
    theme === "system" ? Monitor : resolvedTheme === "dark" ? Moon : Sun;

  return (
    <button
      onClick={cycle}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
      aria-label="Toggle theme"
      title={`Theme: ${theme}`}
    >
      <Icon className="h-4 w-4" strokeWidth={1.5} />
    </button>
  );
}
