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
 *
 * Security: Private/reserved IP ranges are blocked to prevent SSRF attacks.
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

// ── Private IP Detection ────────────────────────────────────────────────────

/**
 * Patterns that match private, reserved, or special-use IP addresses.
 * These should never be fetched to prevent SSRF attacks.
 */
const PRIVATE_IP_PATTERNS = [
  /^10\./,                           // 10.0.0.0/8 (private)
  /^172\.(1[6-9]|2[0-9]|3[01])\./,   // 172.16.0.0/12 (private)
  /^192\.168\./,                     // 192.168.0.0/16 (private)
  /^127\./,                          // 127.0.0.0/8 (loopback)
  /^169\.254\./,                     // 169.254.0.0/16 (link-local)
  /^0\./,                            // 0.0.0.0/8 (current network)
  /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./, // 100.64.0.0/10 (CGNAT)
  /^192\.0\.0\./,                    // 192.0.0.0/24 (IETF protocol assignments)
  /^192\.0\.2\./,                    // 192.0.2.0/24 (TEST-NET-1)
  /^198\.51\.100\./,                 // 198.51.100.0/24 (TEST-NET-2)
  /^203\.0\.113\./,                  // 203.0.113.0/24 (TEST-NET-3)
  /^224\./,                          // 224.0.0.0/4 (multicast)
  /^240\./,                          // 240.0.0.0/4 (reserved)
  /^255\.255\.255\.255$/,            // broadcast
];

/**
 * Check if a domain looks like an IP address (v4 or v6).
 */
function looksLikeIpAddress(domain: string): boolean {
  // IPv4: digits and dots only, 4 octets
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(domain)) return true;
  // IPv6: contains colons (simplified check)
  if (domain.includes(":")) return true;
  return false;
}

/**
 * Check if a domain is a private/reserved IP address.
 * Returns true if it should be blocked.
 */
export function isPrivateOrReservedIp(domain: string): boolean {
  if (!looksLikeIpAddress(domain)) return false;
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(domain));
}

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

  // Block private/reserved IP addresses to prevent SSRF
  if (isPrivateOrReservedIp(domain)) {
    return new Response(JSON.stringify({ error: "Private IP addresses are not allowed" }), {
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
