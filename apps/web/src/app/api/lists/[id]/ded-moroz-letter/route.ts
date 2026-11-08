import { getDesignAccess, getOwnedWishlist } from "@wishlist/db";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { freeDesignTelegramIds } from "@/server/free-designs";
import { readViewer } from "@/server/viewer";
import { createRateLimiter } from "@/server/rate-limit";
import { dedMorozLetterSchema } from "@/lib/ded-moroz-letter";
import { renderDedMorozLetter } from "@/server/ded-moroz-letter-image";
import { PayloadTooLarge, readLimitedJson } from "@/server/limited-json";

export const runtime = "nodejs";
const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });
let rendering = false;

// Как /invitation: данные ребёнка не сохраняются, файл собирается по запросу
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(getEnv().APP_URL).origin) return new Response(null, { status: 403 });
  const { user } = await readViewer();
  if (!user) return new Response(null, { status: 401 });
  if (!limiter.allow(user.id)) return new Response(null, { status: 429 });
  const { id } = await params;
  const list = await getOwnedWishlist(getDb(), user.id, id);
  if (!list) return new Response(null, { status: 404 });
  if (!(await getDesignAccess(getDb(), id, freeDesignTelegramIds())).letter) return new Response(null, { status: 403 });
  let body: unknown;
  try { body = await readLimitedJson(request, 8192); }
  catch (error) { return new Response(null, { status: error instanceof PayloadTooLarge ? 413 : 400 }); }
  const parsed = dedMorozLetterSchema.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 400 });
  if (rendering) return new Response(null, { status: 429, headers: { "Retry-After": "3" } });
  rendering = true;
  try {
    const image = await renderDedMorozLetter(parsed.data);
    const bytes = await image.arrayBuffer();
    return new Response(bytes, { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store", "Content-Disposition": 'attachment; filename="pismo-ot-deda-moroza.png"', "X-Content-Type-Options": "nosniff" } });
  } finally { rendering = false; }
}
