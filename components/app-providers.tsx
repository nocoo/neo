"use client";

import { AccentProvider } from "@nocoo/basalt/providers/accent";
import { LinkProvider } from "@nocoo/basalt/providers/link";
import { ThemeProvider } from "@nocoo/basalt/providers/theme";
import NextLink from "next/link";
import type { ReactNode } from "react";
import { useEffect } from "react";

function AppLink({
  href,
  className,
  children,
  ...props
}: {
  href: string;
  className?: string;
  children?: ReactNode;
} & Record<string, unknown>) {
  if (/^(https?:|mailto:|tel:)/.test(href)) {
    return (
      <a href={href} className={className} {...props}>
        {children}
      </a>
    );
  }
  return (
    <NextLink href={href} className={className} {...props}>
      {children}
    </NextLink>
  );
}

/** Set default accent to purple if not already chosen by user */
function DefaultAccentInit() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("basalt-accent");
      if (!stored) {
        window.localStorage.setItem("basalt-accent", "purple");
        window.dispatchEvent(new Event("storage"));
      }
    }
  }, []);
  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AccentProvider>
        <DefaultAccentInit />
        <LinkProvider render={AppLink}>{children}</LinkProvider>
      </AccentProvider>
    </ThemeProvider>
  );
}
