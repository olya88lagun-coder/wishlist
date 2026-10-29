import { EXTRA_DESIGNS } from "@wishlist/core";
import { afterEach, expect, test, vi } from "vitest";
import { isVerifiedDesignPayment, readPaymentConfig } from "./design-payments";
import { beginDesignPurchase, attachDesignPayment, getDesignOrderByPayment, confirmDesignPayment, rejectUnattachedDesignPurchase } from "@wishlist/db";
import { createDesignCheckout, refreshDesignPayment } from "./design-payments";

vi.mock("@wishlist/db", () => ({ beginDesignPurchase: vi.fn(), attachDesignPayment: vi.fn(), getDesignOrderByPayment: vi.fn(), confirmDesignPayment: vi.fn(), cancelDesignPayment: vi.fn(), rejectUnattachedDesignPurchase: vi.fn() }));
vi.mock("./db", () => ({ getDb: vi.fn() }));
vi.mock("./env", () => ({ getEnv: () => ({ APP_URL: "https://example.test" }) }));

const config = { YOOKASSA_SALES_ENABLED: "true", YOOKASSA_SHOP_ID: "123", YOOKASSA_SECRET_KEY: "test-key", YOOKASSA_VAT_CODE: "1", YOOKASSA_TEST_MODE: "true", YOOKASSA_OFFER_URL: "https://example.test/terms" };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

const order = { id: "order-1", userId: "owner-1", wishlistId: "list-1", amountKopecks: 19900, paymentId: "payment-1" };
const payment = { id: "payment-1", status: "succeeded", paid: true, test: true, amount: { value: "199.00", currency: "RUB" }, metadata: { orderId: "order-1", userId: "owner-1", wishlistId: "list-1" } };

test("sales are disabled by default and require explicit receipt settings and terms", () => {
  expect(readPaymentConfig({})).toBeNull();
  expect(readPaymentConfig({ YOOKASSA_SALES_ENABLED: "true", YOOKASSA_SHOP_ID: "1", YOOKASSA_SECRET_KEY: "secret" })).toBeNull();
});

test("self-employed seller needs no VAT code: receipt settings are optional", () => {
  const { YOOKASSA_VAT_CODE: _vat, ...selfEmployed } = config;
  expect(readPaymentConfig(selfEmployed)).toMatchObject({ YOOKASSA_SHOP_ID: "123" });
  expect(readPaymentConfig({ ...selfEmployed, YOOKASSA_VAT_CODE: "" })?.YOOKASSA_VAT_CODE).toBeUndefined();
  expect(readPaymentConfig({ ...selfEmployed, YOOKASSA_VAT_CODE: "99" })).toBeNull();
  expect(readPaymentConfig({ ...selfEmployed, YOOKASSA_OFFER_URL: undefined })).toBeNull();
});

test("stopping new sales does not block verification of existing payments", () => {
  expect(readPaymentConfig({ ...config, YOOKASSA_SALES_ENABLED: "false" })).toBeNull();
  expect(readPaymentConfig({ ...config, YOOKASSA_SALES_ENABLED: "false" }, false)).not.toBeNull();
  expect(readPaymentConfig({ ...config, YOOKASSA_TAX_SYSTEM_CODE: "" })).not.toBeNull();
});

test("payment must match server price, list, owner, mode and durable payment id", () => {
  expect(isVerifiedDesignPayment(order, payment, true)).toBe(true);
  for (const patch of [
    { status: "pending" }, { paid: false }, { test: false }, { id: "foreign" },
    { amount: { value: "149.00", currency: "RUB" } },
    { amount: { value: "199.00", currency: "USD" } },
    { metadata: { ...payment.metadata, userId: "foreign" } },
    { metadata: { ...payment.metadata, wishlistId: "foreign" } },
    { metadata: { ...payment.metadata, orderId: "foreign" } },
  ]) expect(isVerifiedDesignPayment(order, { ...payment, ...patch }, true)).toBe(false);
});

test("checkout uses durable order price, idempotency key and receipt, never unlocks pending payment", async () => {
  for (const [key, value] of Object.entries(config)) vi.stubEnv(key, value);
  vi.mocked(beginDesignPurchase).mockResolvedValue({ ...order, product: "children_invitation", email: "saved@example.test", paymentId: null, confirmationUrl: null, createdAt: new Date(), status: "pending", testMode: true } as never);
  const fetcher = vi.fn().mockResolvedValue(Response.json({ ...payment, paid: false, status: "pending", confirmation: { confirmation_url: "https://yoomoney.ru/checkout/test" } }));
  vi.stubGlobal("fetch", fetcher);
  expect(await createDesignCheckout("owner-1", "list-1", "children_invitation", "saved@example.test")).toBe("https://yoomoney.ru/checkout/test");
  const init = fetcher.mock.calls[0]![1] as RequestInit;
  const body = JSON.parse(init.body as string);
  expect((init.headers as Record<string, string>)["Idempotence-Key"]).toBe("order-1");
  expect(body.amount).toEqual({ value: "199.00", currency: "RUB" });
  expect(body.receipt.customer.email).toBe("saved@example.test");
  expect(body.confirmation.return_url).toBe("https://example.test/lists/list-1/design?payment=return");
  expect(attachDesignPayment).toHaveBeenCalledWith(undefined, "order-1", "payment-1", "https://yoomoney.ru/checkout/test");
  expect(confirmDesignPayment).not.toHaveBeenCalled();
});

test("checkout without VAT code sends no receipt and keeps the rest of the payment unchanged", async () => {
  const { YOOKASSA_VAT_CODE: _vat, ...selfEmployed } = config;
  for (const [key, value] of Object.entries(selfEmployed)) vi.stubEnv(key, value);
  vi.stubEnv("YOOKASSA_VAT_CODE", "");
  vi.mocked(beginDesignPurchase).mockResolvedValue({ ...order, product: "children_invitation", email: "saved@example.test", paymentId: null, confirmationUrl: null, createdAt: new Date(), status: "pending", testMode: true } as never);
  const fetcher = vi.fn().mockResolvedValue(Response.json({ ...payment, paid: false, status: "pending", confirmation: { confirmation_url: "https://yoomoney.ru/checkout/test" } }));
  vi.stubGlobal("fetch", fetcher);
  expect(await createDesignCheckout("owner-1", "list-1", "children_invitation", "saved@example.test")).toBe("https://yoomoney.ru/checkout/test");
  const body = JSON.parse(fetcher.mock.calls[0]![1].body);
  expect(body).not.toHaveProperty("receipt");
  expect(body.amount).toEqual({ value: "199.00", currency: "RUB" });
  expect(body.capture).toBe(true);
  expect(body.metadata).toEqual({ orderId: "order-1", userId: "owner-1", wishlistId: "list-1" });
});

test("verification re-fetches from provider and rejects substituted amount", async () => {
  for (const [key, value] of Object.entries(config)) vi.stubEnv(key, value);
  vi.mocked(getDesignOrderByPayment).mockResolvedValue({ ...order, status: "pending", testMode: true } as never);
  const fetcher = vi.fn().mockResolvedValue(Response.json({ ...payment, amount: { value: "1.00", currency: "RUB" } }));
  vi.stubGlobal("fetch", fetcher);
  expect(await refreshDesignPayment("payment-1")).toBe(false);
  expect(fetcher.mock.calls[0]![0]).toBe("https://api.yookassa.ru/v3/payments/payment-1");
  expect(confirmDesignPayment).not.toHaveBeenCalled();
  fetcher.mockResolvedValue(Response.json(payment));
  vi.mocked(confirmDesignPayment).mockResolvedValue(true);
  expect(await refreshDesignPayment("payment-1")).toBe(true);
  expect(confirmDesignPayment).toHaveBeenCalledWith(undefined, "order-1", "payment-1");
});

test.each([400, 500])("only definitive field rejection closes the order, HTTP %s", async (status) => {
  for (const [key, value] of Object.entries(config)) vi.stubEnv(key, value);
  vi.mocked(beginDesignPurchase).mockResolvedValue({ ...order, email: "bad@example.test", paymentId: null, confirmationUrl: null, createdAt: new Date(), status: "pending", testMode: true } as never);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ code: status === 400 ? "invalid_request" : "internal_server_error", parameter: "receipt.customer.email" }, { status })));
  await expect(createDesignCheckout("owner-1", "list-1", "children_invitation", "bad@example.test")).rejects.toThrow();
  expect(rejectUnattachedDesignPurchase).toHaveBeenCalledTimes(status === 400 ? 1 : 0);
  expect(attachDesignPayment).not.toHaveBeenCalled();
});

test.each([["new_year", "Новогоднее оформление вишлиста"], ["celebration", "Оформление вишлиста «Праздник»"], ...EXTRA_DESIGNS.map((design) => [design.id, `Оформление вишлиста «${design.label}»`] as const)] as const)("%s checkout sends 149 rubles and the correct service description", async (product, description) => {
  for (const [key, value] of Object.entries(config)) vi.stubEnv(key, value);
  vi.mocked(beginDesignPurchase).mockResolvedValue({ ...order, amountKopecks: 14900, product, email: "saved@example.test", paymentId: null, confirmationUrl: null, createdAt: new Date(), status: "pending", testMode: true } as never);
  const fetcher = vi.fn().mockResolvedValue(Response.json({ ...payment, paid: false, status: "pending", amount: { value: "149.00", currency: "RUB" }, confirmation: { confirmation_url: "https://yoomoney.ru/checkout/test" } }));
  vi.stubGlobal("fetch", fetcher);
  await createDesignCheckout("owner-1", "list-1", product, "saved@example.test");
  const body = JSON.parse(fetcher.mock.calls[0]![1].body);
  expect(body.amount.value).toBe("149.00");
  expect(body.description).toBe(description);
  expect(body.receipt.items[0].description).toBe(body.description);
  expect(confirmDesignPayment).not.toHaveBeenCalled();
});
