/**
 * Favicon proxy tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleFavicon, isValidDomain } from "../src/favicon";

//
// Security: Direct fetches (https://domain/favicon.ico) have been removed.
// Only trusted third-party services (Google, Yandex, DuckDuckGo) are used,
// which eliminates SSRF via DNS rebinding attacks.

describe("isValidDomain", () => {
  it("accepts valid domains", () => {
    expect(isValidDomain("github.com")).toBe(true);
    expect(isValidDomain("www.google.com")).toBe(true);
    expect(isValidDomain("sub.domain.example.org")).toBe(true);
    expect(isValidDomain("a.co")).toBe(true);
  });

  it("rejects empty/null", () => {
    expect(isValidDomain("")).toBe(false);
  });

  it("rejects domains over 253 chars", () => {
    expect(isValidDomain("a".repeat(254))).toBe(false);
  });

  it("rejects domains with double dots", () => {
    expect(isValidDomain("example..com")).toBe(false);
  });

  it("rejects domains with slashes", () => {
    expect(isValidDomain("example//com")).toBe(false);
  });

  it("rejects domains with @", () => {
    expect(isValidDomain("user@example.com")).toBe(false);
  });

  it("rejects invalid characters", () => {
    expect(isValidDomain("exam ple.com")).toBe(false);
    expect(isValidDomain("example$.com")).toBe(false);
  });
});

describe("handleFavicon", () => {
  const image = () => new Response("image-fixture", { headers: { "Content-Type": "image/png" } });

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    try {
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it("rejects invalid domains without a network request", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const response = await handleFavicon("example.com/private");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid domain" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns image content and cache headers from the first trusted source", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(image());
    vi.stubGlobal("fetch", fetchMock);
    const response = await handleFavicon("127.0.0.1");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("image-fixture");
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=86400");
    expect(response.headers.get("X-Favicon-Source")).toBe("google");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.origin).toBe("https://www.google.com");
    expect(url.searchParams.get("domain")).toBe("127.0.0.1");
  });

  it("falls through non-OK and non-image responses to the final trusted source", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(
        new Response("not an image", { headers: { "Content-Type": "text/html" } }),
      )
      .mockResolvedValueOnce(image());
    vi.stubGlobal("fetch", fetchMock);
    const response = await handleFavicon("example.com");
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Favicon-Source")).toBe("duckduckgo");
    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url)).origin)).toEqual([
      "https://www.google.com",
      "https://favicon.yandex.net",
      "https://icons.duckduckgo.com",
    ]);
  });

  it("rejects a response with no content type and accepts the next image", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response("<svg/>", { headers: { "Content-Type": "image/svg+xml" } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const response = await handleFavicon("example.com");
    expect(response.headers.get("X-Favicon-Source")).toBe("yandex");
    expect(response.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(await response.text()).toBe("<svg/>");
  });

  it("releases rejected fetch deadlines before succeeding through a fallback", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce(image());
    vi.stubGlobal("fetch", fetchMock);
    const response = await handleFavicon("example.com");
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Favicon-Source")).toBe("yandex");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts a timed out source and tries the next source", async () => {
    let firstSignal: AbortSignal | null | undefined;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            firstSignal = options?.signal;
            firstSignal?.addEventListener(
              "abort",
              () => reject(new DOMException("Timed out", "AbortError")),
              { once: true },
            );
          }),
      )
      .mockResolvedValueOnce(image());
    vi.stubGlobal("fetch", fetchMock);
    const pending = handleFavicon("example.com");
    await vi.advanceTimersByTimeAsync(5000);
    expect((await pending).headers.get("X-Favicon-Source")).toBe("yandex");
    expect(firstSignal?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns an empty 404 and releases every failed source deadline", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error("network unavailable"));
    vi.stubGlobal("fetch", fetchMock);
    const response = await handleFavicon("example.com");
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });
});
