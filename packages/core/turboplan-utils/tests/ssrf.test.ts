import assert from "node:assert";
import { describe, it } from "node:test";

import {
  assertSafeFetchUrl,
  classifyHost,
  isPrivateHost,
  isPrivateIpAddress,
} from "../src/ssrf";

/**
 * Hostnames are fed through `new URL()` first wherever a test cares about
 * WHATWG canonicalisation (e.g. "[::10.0.0.1]" becoming "[::a00:1]"), matching
 * what the guard actually receives in production.
 */
const hostnameOf = (url: string): string => new URL(url).hostname;

describe("classifyHost — IPv4", () => {
  const loopback = ["127.0.0.1", "127.1.2.3", "0.0.0.0", "localhost"];
  for (const host of loopback) {
    it(`classifies ${host} as loopback`, () => {
      assert.equal(classifyHost(host), "loopback");
    });
  }

  const priv = [
    "10.0.0.5",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.10",
    "169.254.169.254", // cloud metadata
    "100.64.0.1", // CGNAT
    "198.18.0.1", // benchmarking
    "224.0.0.1", // multicast
    "239.255.255.250", // multicast
    "240.0.0.1", // reserved
    "255.255.255.255", // broadcast
    "192.0.0.1", // IETF protocol assignments
  ];
  for (const host of priv) {
    it(`classifies ${host} as private`, () => {
      assert.equal(classifyHost(host), "private");
    });
  }

  const publicHosts = [
    "93.184.216.34",
    "example.com",
    "8.8.8.8",
    "172.32.0.1", // just outside 172.16/12
    "100.128.0.1", // just outside CGNAT
    "198.20.0.1", // just outside 198.18/15
    "223.255.255.255", // just below multicast
  ];
  for (const host of publicHosts) {
    it(`classifies ${host} as public`, () => {
      assert.equal(classifyHost(host), "public");
    });
  }

  it("rejects non-dotted-quad numeric IPv4 forms as invalid", () => {
    assert.equal(classifyHost("2130706433"), "invalid");
    assert.equal(classifyHost("0x7f000001"), "invalid");
    assert.equal(classifyHost("127.1"), "invalid");
    assert.equal(classifyHost("0177.0.0.1"), "invalid");
    assert.equal(classifyHost("1.2.3.999"), "invalid");
  });

  it("treats an empty hostname as invalid", () => {
    assert.equal(classifyHost(""), "invalid");
    assert.equal(classifyHost("   "), "invalid");
  });
});

describe("classifyHost — hostnames", () => {
  it("classifies internal DNS suffixes as private", () => {
    assert.equal(classifyHost("app.internal"), "private");
    assert.equal(classifyHost("printer.local"), "private");
  });

  it("strips trailing dots before matching suffixes", () => {
    assert.equal(classifyHost("app.internal."), "private");
    assert.equal(classifyHost("localhost."), "loopback");
  });

  it("classifies localhost subdomains as loopback", () => {
    assert.equal(classifyHost("sub.localhost"), "loopback");
    assert.equal(classifyHost("LOCALHOST"), "loopback");
  });
});

describe("classifyHost — IPv6", () => {
  it("classifies ::1 and :: as loopback", () => {
    assert.equal(classifyHost("[::1]"), "loopback");
    assert.equal(classifyHost("::1"), "loopback");
    assert.equal(classifyHost("[::]"), "loopback");
    assert.equal(classifyHost("[0:0:0:0:0:0:0:1]"), "loopback");
  });

  it("classifies ULA, link-local and multicast as private", () => {
    assert.equal(classifyHost("[fd00::1]"), "private");
    assert.equal(classifyHost("[fc00::1]"), "private");
    assert.equal(classifyHost("[fe80::1]"), "private");
    assert.equal(classifyHost("[ff02::1]"), "private");
  });

  it("classifies IPv4-mapped private addresses as private", () => {
    assert.equal(classifyHost("[::ffff:10.0.0.1]"), "private");
    assert.equal(classifyHost("[::ffff:a00:1]"), "private");
    assert.equal(classifyHost("[::ffff:127.0.0.1]"), "loopback");
  });

  // F16: WHATWG canonicalises "[::10.0.0.1]" to "[::a00:1]", which has no
  // 0xffff marker — the old guard's v4-mapped-only check let it through.
  it("classifies IPv4-compatible addresses as private", () => {
    assert.equal(classifyHost("[::10.0.0.1]"), "private");
    assert.equal(classifyHost("[::a00:1]"), "private");
    assert.equal(hostnameOf("http://[::10.0.0.1]/"), "[::a00:1]");
    assert.equal(classifyHost(hostnameOf("http://[::10.0.0.1]/")), "private");
  });

  it("classifies NAT64 embedded private addresses as private", () => {
    assert.equal(classifyHost("[64:ff9b::a00:1]"), "private");
    assert.equal(classifyHost("[64:ff9b::10.0.0.1]"), "private");
    assert.equal(classifyHost("[64:ff9b::169.254.169.254]"), "private");
  });

  it("classifies 6to4 with an embedded private address as private", () => {
    // 2002:0a00:0001:: wraps 10.0.0.1
    assert.equal(classifyHost("[2002:a00:1::1]"), "private");
    // 2002:5db8:... wraps 93.184.x.x, a public address
    assert.equal(classifyHost("[2002:5db8:d822::1]"), "public");
  });

  it("classifies public IPv6 as public", () => {
    assert.equal(classifyHost("[2606:4700::1111]"), "public");
    assert.equal(classifyHost("[2001:4860:4860::8888]"), "public");
    assert.equal(classifyHost("[64:ff9b::5db8:d822]"), "public");
  });

  it("treats malformed IPv6 literals as invalid", () => {
    assert.equal(classifyHost("[::1"), "invalid");
    assert.equal(classifyHost("[1:2:3]"), "invalid");
    assert.equal(classifyHost("[gggg::1]"), "invalid");
    assert.equal(classifyHost("[1::2::3]"), "invalid");
  });
});

describe("isPrivateHost / isPrivateIpAddress", () => {
  it("treats anything non-public as private", () => {
    assert.equal(isPrivateHost("10.0.0.1"), true);
    assert.equal(isPrivateHost("localhost"), true);
    assert.equal(isPrivateHost("nonsense.host.invalidtld"), false);
    assert.equal(isPrivateHost("example.com"), false);
  });

  it("classifies bare resolver output, IPv6 unbracketed", () => {
    assert.equal(isPrivateIpAddress("10.0.0.1"), true);
    assert.equal(isPrivateIpAddress("fd00::1"), true);
    assert.equal(isPrivateIpAddress("::ffff:169.254.169.254"), true);
    assert.equal(isPrivateIpAddress("93.184.216.34"), false);
    assert.equal(isPrivateIpAddress("2606:4700::1111"), false);
  });
});

describe("assertSafeFetchUrl", () => {
  const check = (
    url: string,
    opts?: Parameters<typeof assertSafeFetchUrl>[1],
  ) => assertSafeFetchUrl(new URL(url), opts);

  it("accepts public https URLs", () => {
    assert.equal(check("https://example.com/logo.png"), null);
    assert.equal(check("https://93.184.216.34/x"), null);
    assert.equal(check("https://[2606:4700::1111]/x"), null);
  });

  it("rejects http by default and allows it with allowHttp", () => {
    assert.notEqual(check("http://example.com"), null);
    assert.equal(check("http://example.com", { allowHttp: true }), null);
  });

  it("rejects embedded credentials", () => {
    const error = check("https://user:pw@example.com");
    assert.ok(error?.includes("credentials"));
  });

  // F4: loopback must be blocked regardless of scheme.
  it("rejects https loopback just like http loopback", () => {
    for (const url of [
      "https://127.0.0.1/x",
      "https://[::1]/x",
      "https://localhost/x",
      "http://127.0.0.1/x",
      "http://localhost/x",
    ]) {
      assert.notEqual(check(url, { allowHttp: true }), null, url);
    }
  });

  // F9: loopback is only reachable behind an explicit dev opt-in.
  it("accepts loopback only when allowLoopback is set", () => {
    assert.equal(check("http://localhost:3001", { allowLoopback: true }), null);
    assert.equal(check("https://127.0.0.1", { allowLoopback: true }), null);
    assert.equal(check("http://[::1]:8080", { allowLoopback: true }), null);
    assert.notEqual(check("http://localhost:3001"), null);
  });

  it("allowLoopback does not open up other private ranges", () => {
    assert.notEqual(check("https://10.0.0.5", { allowLoopback: true }), null);
    assert.notEqual(
      check("http://169.254.169.254", { allowLoopback: true, allowHttp: true }),
      null,
    );
  });

  it("rejects invalid hosts rather than passing them through", () => {
    const error = assertSafeFetchUrl({
      protocol: "https:",
      username: "",
      password: "",
      hostname: "0177.0.0.1",
    } as URL);
    assert.ok(error?.includes("invalid host"));
  });

  it("uses the supplied label in messages", () => {
    const error = check("http://example.com", { label: "Logo URL" });
    assert.ok(error?.startsWith("Logo URL"));
  });
});
