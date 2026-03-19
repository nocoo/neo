/**
 * Favicon proxy with waterfall sources.
 * Solves access issues to Google Favicon API from China.
 *
 * GET /favicon/:domain
 *
 * Sources tried in order:
 * 1. Google Favicon API
 * 2. Yandex Favicon API
 * 3. Direct HTTPS /favicon.ico
 * 4. Direct HTTP /favicon.ico
 */

const FAVICON_SOURCES = [
  {
    name: "google",
    url: (domain: string) =>
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`,
    timeout: 5000,
  },
  {
    name: "yandex",
    url: (domain: string) =>
      `https://favicon.yandex.net/favicon/${encodeURIComponent(domain)}`,
    timeout: 5000,
  },
  {
    name: "direct-https",
    url: (domain: string) => `https://${domain}/favicon.ico`,
    timeout: 3000,
  },
  {
    name: "direct-http",
    url: (domain: string) => `http://${domain}/favicon.ico`,
    timeout: 3000,
  },
];

const DOMAIN_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Validate a domain string.
 */
export function isValidDomain(domain: string): boolean {
  if (!domain || domain.length > 253) return false;
  if (domain.includes("..") || domain.includes("//") || domain.includes("@")) return false;
  return DOMAIN_REGEX.test(domain);
}

/**
 * Handle favicon proxy request.
 */
export async function handleFavicon(domain: string): Promise<Response> {
  if (!isValidDomain(domain)) {
    return new Response(JSON.stringify({ error: "Invalid domain" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  for (const source of FAVICON_SOURCES) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), source.timeout);

      const response = await fetch(source.url(domain), {
        signal: controller.signal,
        headers: { "User-Agent": "Neo-Favicon-Proxy/1.0" },
      });

      clearTimeout(timeoutId);

      if (
        response.ok &&
        (response.headers.get("content-type") || "").startsWith("image/")
      ) {
        return new Response(response.body, {
          status: 200,
          headers: {
            "Content-Type": response.headers.get("content-type") || "image/x-icon",
            "Cache-Control": "public, max-age=86400",
            "X-Favicon-Source": source.name,
          },
        });
      }
    } catch {
      // Source failed, try next
      continue;
    }
  }

  // All sources failed
  return new Response(null, { status: 404 });
}
