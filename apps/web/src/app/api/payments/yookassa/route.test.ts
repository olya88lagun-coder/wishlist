import { beforeEach, expect, test, vi } from "vitest";
import { getDesignOrderByPayment } from "@wishlist/db";
import { refreshDesignPayment } from "@/server/design-payments";
import { POST } from "./route";

vi.mock("@wishlist/db", () => ({ getDesignOrderByPayment: vi.fn() }));
vi.mock("@/server/db", () => ({ getDb: vi.fn() }));
vi.mock("@/server/design-payments", () => ({ readPaymentConfig: () => ({}), refreshDesignPayment: vi.fn() }));
const request = (object: unknown) => new Request("https://example.test/api/payments/yookassa", { method: "POST", body: JSON.stringify(object) });
const event = { type: "notification", event: "payment.succeeded", object: { id: "known-payment", status: "succeeded", amount: { value: "0.01", currency: "USD" } } };
beforeEach(() => { vi.clearAllMocks(); });

test("webhook forwards only stored payment id, not claimed status or price", async () => {
  vi.mocked(getDesignOrderByPayment).mockResolvedValue({ id: "known-order", paymentId: "known-payment" } as never);
  vi.mocked(refreshDesignPayment).mockResolvedValue(false);
  expect((await POST(request(event))).status).toBe(200);
  expect(refreshDesignPayment).toHaveBeenCalledExactlyOnceWith("known-payment");
});

test("malformed and unknown notifications cannot consume another order's quota", async () => {
  for (let i = 0; i < 125; i++) expect((await POST(request({}))).status).toBe(400);
  vi.mocked(getDesignOrderByPayment).mockResolvedValue(null);
  expect((await POST(request(event))).status).toBe(503);
  expect(refreshDesignPayment).not.toHaveBeenCalled();
  vi.mocked(getDesignOrderByPayment).mockResolvedValue({ id: "other-order", paymentId: "known-payment" } as never);
  vi.mocked(refreshDesignPayment).mockResolvedValue(true);
  expect((await POST(request(event))).status).toBe(200);
});

test("provider outage leaves notification retryable", async () => {
  vi.mocked(getDesignOrderByPayment).mockResolvedValue({ id: "order-3", paymentId: "known-payment" } as never);
  vi.mocked(refreshDesignPayment).mockRejectedValue(new Error("Provider timeout"));
  expect((await POST(request(event))).status).toBe(503);
});
