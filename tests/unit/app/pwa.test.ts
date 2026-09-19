import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import manifest from "@/app/manifest";
import brandSource from "@/assets/brand/source.json";

const { mockToaster } = vi.hoisted(() => ({
  mockToaster: vi.fn((_props: Record<string, unknown>) => null),
}));

vi.mock("@/components/app-providers", () => ({
  AppProviders: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/ui/sonner", () => ({ Toaster: mockToaster }));

vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "--font-inter" }),
  DM_Sans: () => ({ variable: "--font-display" }),
}));

import RootLayout, { metadata, viewport } from "@/app/layout";

function readAsset(path: string): Buffer {
  // Both the normal suite and the pre-commit snapshot run from the repo root.
  // Keep file reads out of Vite's new URL(..., import.meta.url) asset transform.
  return readFileSync(path);
}

function readPng(path: string) {
  const bytes = readAsset(path);
  expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(bytes.toString("ascii", 12, 16)).toBe("IHDR");
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes[24],
    colorType: bytes[25],
  };
}

describe("PWA metadata", () => {
  it("preserves Sonner's 24px desktop and 16px mobile offsets before the bottom inset", () => {
    renderToStaticMarkup(RootLayout({ children: null }));
    expect(mockToaster.mock.lastCall?.[0]).toMatchObject({
      offset: { bottom: "calc(24px + env(safe-area-inset-bottom, 0px))" },
      mobileOffset: { bottom: "calc(16px + env(safe-area-inset-bottom, 0px))" },
    });
  });

  it("declares the installed app name and default Apple status bar without a startup image", () => {
    expect(metadata.appleWebApp).toEqual({
      capable: true,
      title: "Neo",
      statusBarStyle: "default",
    });
  });

  it("covers the viewport, preserves zoom, and matches the manifest theme", () => {
    expect(viewport).toMatchObject({
      width: "device-width",
      initialScale: 1,
      viewportFit: "cover",
      themeColor: manifest().theme_color,
    });
    expect(viewport).not.toHaveProperty("maximumScale");
    expect(viewport).not.toHaveProperty("userScalable", false);
    expect(manifest()).toMatchObject({ display: "standalone", start_url: "/", scope: "/" });
  });
});

describe("PWA asset contracts", () => {
  it("keeps the adopted masters consistent with their recorded provenance", () => {
    for (const [path, source] of Object.entries(brandSource.masters)) {
      expect(createHash("sha256").update(readAsset(path)).digest("hex")).toBe(source.sha256);
      expect(readPng(path)).toMatchObject({ width: source.width, height: source.height });
    }
  });

  it("ships an opaque 180px RGB Apple touch icon", () => {
    expect(readPng("app/apple-icon.png")).toEqual({
      width: 180,
      height: 180,
      bitDepth: 8,
      colorType: 2,
    });
  });

  it("resolves every manifest and shortcut icon to an opaque PNG of the declared size", () => {
    const data = manifest();
    expect(data.icons?.map((icon) => icon.sizes)).toEqual(["192x192", "512x512"]);
    const icons = [
      ...(data.icons ?? []),
      ...(data.shortcuts ?? []).flatMap((item) => item.icons ?? []),
    ];
    for (const icon of icons) {
      const png = readPng(`public${icon.src}`);
      expect(`${png.width}x${png.height}`).toBe(icon.sizes);
      expect(png.colorType).toBe(2);
      expect(png.bitDepth).toBe(8);
      expect(icon.purpose).not.toBe("maskable");
    }
  });

  it("ships the PNG favicon and both ICO resolutions", () => {
    expect(readPng("app/icon.png")).toMatchObject({ width: 32, height: 32 });
    const ico = readAsset("app/favicon.ico");
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(2);
    expect([ico[6], ico[7], ico[22], ico[23]]).toEqual([16, 16, 32, 32]);
  });
});
