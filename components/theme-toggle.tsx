"use client";

import {
  ThemeToggle as BasaltThemeToggle,
  type ThemeToggleProps,
} from "@nocoo/basalt/components/theme-toggle";

export function ThemeToggle({
  "aria-label": ariaLabel = "Toggle theme",
  ...props
}: ThemeToggleProps = {}) {
  return <BasaltThemeToggle aria-label={ariaLabel} {...props} />;
}

export type { ThemeToggleProps } from "@nocoo/basalt/components/theme-toggle";
