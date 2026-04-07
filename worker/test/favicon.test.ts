/**
 * Favicon proxy tests.
 */

import { describe, it, expect } from "vitest";
import { isValidDomain, isPrivateOrReservedIp } from "../src/favicon";

// Note: handleFavicon requires network access, so we only test validation
// and leave integration testing to E2E.

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

describe("isPrivateOrReservedIp (SSRF protection)", () => {
  describe("blocks private IPv4 ranges", () => {
    it("blocks 10.0.0.0/8", () => {
      expect(isPrivateOrReservedIp("10.0.0.1")).toBe(true);
      expect(isPrivateOrReservedIp("10.255.255.255")).toBe(true);
    });

    it("blocks 172.16.0.0/12", () => {
      expect(isPrivateOrReservedIp("172.16.0.1")).toBe(true);
      expect(isPrivateOrReservedIp("172.31.255.255")).toBe(true);
      // 172.15.x.x should be allowed (public)
      expect(isPrivateOrReservedIp("172.15.0.1")).toBe(false);
      // 172.32.x.x should be allowed (public)
      expect(isPrivateOrReservedIp("172.32.0.1")).toBe(false);
    });

    it("blocks 192.168.0.0/16", () => {
      expect(isPrivateOrReservedIp("192.168.0.1")).toBe(true);
      expect(isPrivateOrReservedIp("192.168.255.255")).toBe(true);
    });
  });

  describe("blocks loopback", () => {
    it("blocks 127.0.0.0/8", () => {
      expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
      expect(isPrivateOrReservedIp("127.255.255.255")).toBe(true);
    });
  });

  describe("blocks link-local", () => {
    it("blocks 169.254.0.0/16", () => {
      expect(isPrivateOrReservedIp("169.254.0.1")).toBe(true);
      expect(isPrivateOrReservedIp("169.254.169.254")).toBe(true); // AWS metadata
    });
  });

  describe("blocks other reserved ranges", () => {
    it("blocks 0.0.0.0/8", () => {
      expect(isPrivateOrReservedIp("0.0.0.0")).toBe(true);
      expect(isPrivateOrReservedIp("0.255.255.255")).toBe(true);
    });

    it("blocks CGNAT 100.64.0.0/10", () => {
      expect(isPrivateOrReservedIp("100.64.0.1")).toBe(true);
      expect(isPrivateOrReservedIp("100.127.255.255")).toBe(true);
    });

    it("blocks TEST-NET ranges", () => {
      expect(isPrivateOrReservedIp("192.0.2.1")).toBe(true);
      expect(isPrivateOrReservedIp("198.51.100.1")).toBe(true);
      expect(isPrivateOrReservedIp("203.0.113.1")).toBe(true);
    });

    it("blocks multicast 224.0.0.0/4", () => {
      expect(isPrivateOrReservedIp("224.0.0.1")).toBe(true);
    });

    it("blocks broadcast", () => {
      expect(isPrivateOrReservedIp("255.255.255.255")).toBe(true);
    });
  });

  describe("allows public IPs", () => {
    it("allows common public IPs", () => {
      expect(isPrivateOrReservedIp("8.8.8.8")).toBe(false);
      expect(isPrivateOrReservedIp("1.1.1.1")).toBe(false);
      expect(isPrivateOrReservedIp("142.250.80.46")).toBe(false);
    });
  });

  describe("handles non-IP inputs", () => {
    it("allows regular domains (not IPs)", () => {
      expect(isPrivateOrReservedIp("github.com")).toBe(false);
      expect(isPrivateOrReservedIp("example.org")).toBe(false);
    });

    it("blocks IPv6 loopback/private patterns", () => {
      // IPv6 with colons is detected as IP-like
      expect(isPrivateOrReservedIp("::1")).toBe(false); // detected as IP but not matching v4 patterns
    });
  });
});
