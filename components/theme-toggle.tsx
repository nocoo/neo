import {
  ThemeToggle as BasaltThemeToggle,
  type ThemeToggleProps as BasaltThemeToggleProps,
} from "@nocoo/basalt/components/theme-toggle";

export type ThemeToggleProps = Partial<BasaltThemeToggleProps>;

export function ThemeToggle({ "aria-label": ariaLabel = "Toggle theme" }: ThemeToggleProps = {}) {
  return <BasaltThemeToggle aria-label={ariaLabel} />;
}
