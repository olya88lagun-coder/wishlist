import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { COMPLETION_COOKIE_PREFIX, COMPLETION_MAX_AGE_SECONDS } from "@/lib/analytics-events";

type Completion =
  | { event: "auth_completed"; params: { provider: "telegram" | "vk" | "telegram_miniapp"; source?: "santa" } }
  | { event: "wishlist_created"; params: { source: "finder" | "direct" } }
  | { event: "santa_created"; params: Record<string, never> }
  | { event: "santa_joined"; params: { signed_in: boolean } }
  | { event: "santa_drawn"; params: Record<string, never> };

export function completionCookie(completion: Completion) {
  return {
    name: `${COMPLETION_COOKIE_PREFIX}${randomUUID().replaceAll("-", "")}`,
    value: JSON.stringify(completion),
    path: "/", maxAge: COMPLETION_MAX_AGE_SECONDS, secure: true, sameSite: "lax" as const,
  };
}

export async function recordCompletion(completion: Completion) {
  try { (await cookies()).set(completionCookie(completion)); } catch { /* Измерение не должно мешать успешному созданию списка. */ }
}
