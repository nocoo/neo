"use client";

import { AccentProvider } from "@nocoo/basalt/providers/accent";
import { LinkProvider } from "@nocoo/basalt/providers/link";
import { ThemeProvider } from "@nocoo/basalt/providers/theme";
import NextLink from "next/link";
import type { ReactNode } from "react";

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

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AccentProvider defaultAccent="purple">
        <LinkProvider render={AppLink}>{children}</LinkProvider>
      </AccentProvider>
    </ThemeProvider>
  );
}
