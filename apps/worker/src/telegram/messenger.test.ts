import { GrammyError, HttpError } from "grammy";
import { expect, test } from "vitest";
import { outcomeOf } from "./messenger";

function apiError(code: number, description: string) {
  return new GrammyError(`Call failed (${code}: ${description})`, { ok: false, error_code: code, description }, "sendMessage", {});
}

test("permanent Telegram refusals are not retried", () => {
  expect(outcomeOf(apiError(403, "Forbidden: bot was blocked by the user"))).toBe("rejected");
  expect(outcomeOf(apiError(400, "Bad Request: chat not found"))).toBe("rejected");
});

test("editing to the same content counts as success", () => {
  expect(outcomeOf(apiError(400, "Bad Request: message is not modified: specified new message content and reply markup are exactly the same"))).toBe("sent");
});

test("rate limits, server and network errors are temporary", () => {
  expect(outcomeOf(apiError(429, "Too Many Requests: retry after 5"))).toBe("failed");
  expect(outcomeOf(apiError(502, "Bad Gateway"))).toBe("failed");
  expect(outcomeOf(new HttpError("Network request for 'sendMessage' failed!", new Error("ECONNRESET")))).toBe("failed");
});
