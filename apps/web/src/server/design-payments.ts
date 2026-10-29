import { attachDesignPayment, beginDesignPurchase, cancelDesignPayment, confirmDesignPayment, getDesignOrderByPayment, rejectUnattachedDesignPurchase, type DesignOrder, type DesignProduct } from "@wishlist/db";
import { z } from "zod";
import { getDb } from "./db";
import { getEnv } from "./env";

const configSchema = z.object({
  YOOKASSA_SALES_ENABLED: z.literal("true"),
  YOOKASSA_SHOP_ID: z.string().regex(/^\d+$/),
  YOOKASSA_SECRET_KEY: z.string().min(1),
  // Без кода НДС платёж создаётся без чека: самозанятый оформляет чек в «Мой налог» сам.
  YOOKASSA_VAT_CODE: z.coerce.number().int().min(1).max(12).optional(),
  YOOKASSA_TAX_SYSTEM_CODE: z.coerce.number().int().min(1).max(6).optional(),
  YOOKASSA_OFFER_URL: z.url().startsWith("https://"),
  YOOKASSA_TEST_MODE: z.enum(["true", "false"]),
});

export function readPaymentConfig(source: Record<string, string | undefined> = process.env, requireSales = true) {
  const normalized = { ...source, YOOKASSA_VAT_CODE: source.YOOKASSA_VAT_CODE || undefined, YOOKASSA_TAX_SYSTEM_CODE: source.YOOKASSA_TAX_SYSTEM_CODE || undefined };
  const result = configSchema.safeParse(requireSales ? normalized : { ...normalized, YOOKASSA_SALES_ENABLED: "true" });
  return result.success ? result.data : null;
}

const paymentSchema = z.object({
  id: z.string().min(1).max(100), status: z.string(), paid: z.boolean(), test: z.boolean(),
  amount: z.object({ value: z.string().regex(/^\d+\.\d{2}$/), currency: z.string() }),
  metadata: z.object({ orderId: z.string(), wishlistId: z.string(), userId: z.string() }),
  confirmation: z.object({ confirmation_url: z.url().startsWith("https://").optional() }).optional(),
});
type Payment = z.infer<typeof paymentSchema>;
type ExpectedOrder = Pick<DesignOrder, "id" | "userId" | "wishlistId" | "amountKopecks" | "paymentId">;

function matchesOrder(order: ExpectedOrder, payment: Payment, testMode: boolean) {
  return payment.id === order.paymentId && payment.test === testMode && payment.amount.currency === "RUB"
    && payment.amount.value === (order.amountKopecks / 100).toFixed(2)
    && payment.metadata.orderId === order.id && payment.metadata.wishlistId === order.wishlistId && payment.metadata.userId === order.userId;
}

export function isVerifiedDesignPayment(order: ExpectedOrder, data: unknown, testMode: boolean): boolean {
  const parsed = paymentSchema.safeParse(data);
  return parsed.success && parsed.data.status === "succeeded" && parsed.data.paid && matchesOrder(order, parsed.data, testMode);
}

async function api(path: string, init: RequestInit = {}) {
  const config = readPaymentConfig(process.env, false);
  if (!config) throw new Error("Оплата пока недоступна");
  const response = await fetch(`https://api.yookassa.ru/v3/${path}`, {
    ...init, cache: "no-store", signal: AbortSignal.timeout(15_000),
    headers: { "Content-Type": "application/json", Authorization: `Basic ${Buffer.from(`${config.YOOKASSA_SHOP_ID}:${config.YOOKASSA_SECRET_KEY}`).toString("base64")}`, ...init.headers },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    if (response.status === 400 && error?.code === "invalid_request" && error?.parameter) throw new RejectedCheckout();
    throw new Error("Не удалось связаться с платёжным сервисом");
  }
  return paymentSchema.parse(await response.json());
}

class RejectedCheckout extends Error {}

export async function createDesignCheckout(userId: string, wishlistId: string, product: DesignProduct, email: string): Promise<string | null> {
  const config = readPaymentConfig();
  if (!config) throw new Error("Оплата пока недоступна");
  const order = await beginDesignPurchase(getDb(), userId, wishlistId, product, email, config.YOOKASSA_TEST_MODE === "true");
  if (!order) return null;
  if (order.paymentId && order.confirmationUrl) return order.confirmationUrl;
  // The provider retains idempotency keys for 24 hours. Never recreate an ambiguous older charge.
  if (Date.now() - order.createdAt.getTime() > 23 * 60 * 60 * 1000) throw new Error("Нужна проверка предыдущего платежа");
  const amount = { value: (order.amountKopecks / 100).toFixed(2), currency: "RUB" };
  const description = product === "celebration" ? "Оформление вишлиста «Праздник»" : product === "new_year" ? "Новогоднее оформление вишлиста" : product === "children" ? "Детское оформление вишлиста" : "Детское оформление и приглашение";
  let payment: Payment;
  try { payment = await api("payments", {
    method: "POST", headers: { "Idempotence-Key": order.id },
    body: JSON.stringify({ amount, capture: true, description,
      confirmation: { type: "redirect", return_url: `${getEnv().APP_URL.replace(/\/$/, "")}/lists/${wishlistId}/design?payment=return` },
      metadata: { orderId: order.id, userId, wishlistId },
      ...(config.YOOKASSA_VAT_CODE ? { receipt: { customer: { email: order.email },
        ...(config.YOOKASSA_TAX_SYSTEM_CODE ? { tax_system_code: config.YOOKASSA_TAX_SYSTEM_CODE } : {}),
        items: [{ description, quantity: "1.00", amount, vat_code: config.YOOKASSA_VAT_CODE, payment_mode: "full_payment", payment_subject: "service" }],
      } } : {}),
    }),
  }); } catch (error) {
    // Only an explicit field-validation rejection is safe to close. Timeouts/5xx stay retryable with the same key.
    if (error instanceof RejectedCheckout) await rejectUnattachedDesignPurchase(getDb(), order.id);
    throw error;
  }
  if (!matchesOrder({ ...order, paymentId: payment.id }, payment, config.YOOKASSA_TEST_MODE === "true")) throw new Error("Платёж требует проверки");
  const url = payment.confirmation?.confirmation_url ?? null;
  await attachDesignPayment(getDb(), order.id, payment.id, url);
  if (payment.status === "succeeded" || payment.status === "canceled") await refreshDesignPayment(payment.id);
  return url ?? `${getEnv().APP_URL.replace(/\/$/, "")}/lists/${wishlistId}/design?payment=return`;
}

export async function refreshDesignPayment(paymentId: string): Promise<boolean> {
  if (!/^[\w-]{1,100}$/.test(paymentId)) return false;
  const order = await getDesignOrderByPayment(getDb(), paymentId);
  if (!order) return false;
  if (order.status !== "pending") return order.status === "succeeded";
  const config = readPaymentConfig(process.env, false);
  if (!config) return false;
  const payment = await api(`payments/${encodeURIComponent(paymentId)}`);
  if (isVerifiedDesignPayment(order, payment, order.testMode)) return confirmDesignPayment(getDb(), order.id, paymentId);
  if (payment.status === "canceled" && matchesOrder(order, payment, order.testMode)) await cancelDesignPayment(getDb(), order.id, paymentId);
  return false;
}
