/**
 * ThemeToggle component tests — covers the cycle() branches using Basalt ThemeProvider.
 */

import { ThemeProvider } from "@nocoo/basalt/providers/theme";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "@/components/theme-toggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
  });

  it("cycles theme through system, light, dark", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    const toggleBtn = screen.getByRole("button", { name: /toggle theme/i });
    expect(toggleBtn).toBeDefined();

    // system -> light
    fireEvent.click(toggleBtn);
    expect(localStorage.getItem("theme")).toBe("light");

    // light -> dark
    fireEvent.click(toggleBtn);
    expect(localStorage.getItem("theme")).toBe("dark");

    // dark -> system
    fireEvent.click(toggleBtn);
    expect(localStorage.getItem("theme")).toBe("system");
  });
});
