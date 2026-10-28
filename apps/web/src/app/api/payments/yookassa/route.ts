import { getDesignOrderByPayment } from "@wishlist/db";
import { z } from "zod";
import { getDb } from "@/server/db";
import { readPaymentConfig, refreshDesignPayment } from "@/server/design-payments";
import { createRateLimiter } from "@/server/rate-limit";
import { PayloadTooLarge, readLimitedJson } from "@/server/limited-json";

const limiter = createRateLimiter({ limit: 120, windowMs: 60_000 });
const schema = z.object({ type: z.literal("notification"), event: z.enum(["payment.succeeded", "payment.canceled"]), object: z.object({ id: z.string().regex(/^[\w-]{1,100}$/) }) });

export async function POST(request: Request) {
  if (!readPaymentConfig(process.env, false)) return new Response(null, { status: 503 });
  let body: unknown;
  try { body = await readLimitedJson(request, 16_384); }
  catch (error) { return new Response(null, { status: error instanceof PayloadTooLarge ? 413 : 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 400 });
  // Ignore claimed status and price. Verify the known order against the authenticated provider API.
  const order = await getDesignOrderByPayment(getDb(), parsed.data.object.id);
  if (!order) return new Response(null, { status: 503 });
  if (!limiter.allow(order.id)) return new Response(null, { status: 429 });
  try { await refreshDesignPayment(order.paymentId!); return new Response(null, { status: 200 }); }
  catch { return new Response(null, { status: 503 }); }
}
