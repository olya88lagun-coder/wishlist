import { expect, test } from "vitest";
import { PayloadTooLarge, readLimitedJson } from "./limited-json";

test("bounds actual UTF-8 bytes even without Content-Length", async () => {
  const request = new Request("https://example.test", { method: "POST", body: JSON.stringify({ name: "Саша" }) });
  expect(await readLimitedJson(request.clone(), 100)).toEqual({ name: "Саша" });
  await expect(readLimitedJson(request, 10)).rejects.toBeInstanceOf(PayloadTooLarge);
});

test("rejects malformed JSON and oversized declared payload", async () => {
  await expect(readLimitedJson(new Request("https://example.test", { method: "POST", body: "{" }), 20)).rejects.toBeInstanceOf(SyntaxError);
  await expect(readLimitedJson(new Request("https://example.test", { method: "POST", headers: { "Content-Length": "1000" }, body: "{}" }), 20)).rejects.toBeInstanceOf(PayloadTooLarge);
});
