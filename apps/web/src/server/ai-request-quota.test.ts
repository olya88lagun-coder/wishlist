import { expect, test } from "vitest";
import { aiNetworkHash, guestNetworkLimit, reservationCost, hasBillableUsage } from "./ai-request-quota";

const secret = "local-test-session-secret-only-32-characters";
const network = (ip?: string) => aiNetworkHash(new Headers(ip ? { "x-forwarded-for": ip } : {}), secret);

test("uses the final trusted Caddy hop, not a client-supplied prefix", () => {
  expect(network("198.51.100.1, 203.0.113.2")).toBe(network("203.0.113.2"));
  expect(network("198.51.100.5, 203.0.113.2")).toBe(network("203.0.113.2"));
  expect(network("203.0.113.3")).not.toBe(network("203.0.113.2"));
  expect(network("203.0.113.2")).not.toContain("203.0.113.2");
  expect(aiNetworkHash(new Headers({ "x-forwarded-for": "203.0.113.2" }), secret + "x")).not.toBe(network("203.0.113.2"));
});

test("canonicalizes mapped IPv4 and groups IPv6 privacy addresses by /64", () => {
  expect(network("::ffff:203.0.113.2")).toBe(network("203.0.113.2"));
  expect(network("2001:db8:abcd:1::1")).toBe(network("2001:0db8:abcd:0001:0:0:0:99"));
  expect(network("2001:db8:abcd:2::1")).not.toBe(network("2001:db8:abcd:1::1"));
});

test("missing and malformed proxy addresses share a fail-closed bucket", () => {
  for (const ip of [undefined, "garbage", "1.2.3.4,", "1.2.3.4:99999", "fe80::1%eth0"]) expect(network(ip)).toBe(network());
});

test("network quota defaults to the guest limit and can be configured including zero", () => {
  expect(guestNetworkLimit(5, {})).toBe(5);
  expect(guestNetworkLimit(5, { AI_DAILY_LIMIT_GUEST_NETWORK: "9" })).toBe(9);
  expect(guestNetworkLimit(5, { AI_DAILY_LIMIT_GUEST_NETWORK: "0" })).toBe(0);
  expect(guestNetworkLimit(5, { AI_DAILY_LIMIT_GUEST_NETWORK: "-1" })).toBe(5);
});

test("reserves all bounded attempts including input bytes and output headroom", () => {
  const price = { inputRubPerMillion: 10, outputRubPerMillion: 100 };
  const bodies = [{ input: "мама", max_output_tokens: 1400 }, { messages: ["longer retry"], max_tokens: 1200 }];
  const cost = reservationCost(bodies, price);
  expect(cost).toBeGreaterThan(2 * 1400 * 100 + 2 * 1200 * 100);
  expect(reservationCost([...bodies, bodies[0]!], price)).toBeGreaterThan(cost);
});

test("only complete finite nonnegative usage can release reserved headroom", () => {
  expect(hasBillableUsage({ usage: { prompt_tokens: 10, completion_tokens: 2 } })).toBe(true);
  expect(hasBillableUsage({ usage: { input_tokens: 0, output_tokens: 0 } })).toBe(true);
  for (const usage of [{}, { prompt_tokens: 1 }, { input_tokens: -1, output_tokens: 2 }, { input_tokens: 1, output_tokens: NaN }, { prompt_tokens: -1, completion_tokens: 100, input_tokens: 100, output_tokens: 100 }]) {
    expect(hasBillableUsage({ usage })).toBe(false);
  }
});
