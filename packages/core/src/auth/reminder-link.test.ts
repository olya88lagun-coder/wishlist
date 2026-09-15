import { expect, test } from "vitest";
import { signReminderPayload, verifyReminderPayload } from "./reminder-link";

const SECRET = "s".repeat(32);
const ID = "3c5e5e81-358d-4c3d-b4ed-100bac8fea49";

test("round-trips a reservation id through a Telegram start parameter", () => {
  const payload = signReminderPayload(ID, SECRET);
  expect(payload).toMatch(/^r[A-Za-z0-9_-]{38}$/);
  expect(payload.length).toBeLessThanOrEqual(64);
  expect(verifyReminderPayload(payload, SECRET)).toBe(ID);
});

test("rejects forged, truncated and foreign payloads", () => {
  const payload = signReminderPayload(ID, SECRET);
  const forged = `${payload.slice(0, -1)}${payload.endsWith("A") ? "B" : "A"}`;
  expect(verifyReminderPayload(forged, SECRET)).toBeNull();
  expect(verifyReminderPayload(payload.slice(0, 20), SECRET)).toBeNull();
  expect(verifyReminderPayload(payload, "x".repeat(32))).toBeNull();
  expect(verifyReminderPayload("inline", SECRET)).toBeNull();
});
