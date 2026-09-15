import { randomBytes } from "node:crypto";
import type { Viewer } from "@wishlist/core";
import type { UserWithIdentities } from "@wishlist/db";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "./auth-service";
import { getDb } from "./db";
import { getEnv } from "./env";
import { SESSION_COOKIE } from "./http";

export const GUEST_COOKIE = "wl_guest";
const GUEST_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const GUEST_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function guestCookieOptions() {
  return { httpOnly: true, secure: true, sameSite: "none", path: "/", maxAge: GUEST_COOKIE_MAX_AGE_SECONDS } as const;
}

async function currentUser(): Promise<UserWithIdentities | null> {
  const store = await cookies();
  return getCurrentUser({ db: getDb(), env: getEnv() }, store.get(SESSION_COOKIE)?.value ?? null);
}

export async function readViewer(): Promise<{ viewer: Viewer; user: UserWithIdentities | null }> {
  const store = await cookies();
  const raw = store.get(GUEST_COOKIE)?.value ?? null;
  const user = await currentUser();
  return { user, viewer: { userId: user?.id ?? null, guestToken: raw && GUEST_TOKEN_PATTERN.test(raw) ? raw : null } };
}

export async function ensureGuestViewer(): Promise<{ viewer: Viewer; user: UserWithIdentities | null }> {
  const current = await readViewer();
  if (current.viewer.guestToken) return current;
  const guestToken = randomBytes(32).toString("base64url");
  (await cookies()).set(GUEST_COOKIE, guestToken, guestCookieOptions());
  return { user: current.user, viewer: { ...current.viewer, guestToken } };
}

export async function requireUser(): Promise<UserWithIdentities> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function clientKey(viewer: Viewer): Promise<string> {
  if (viewer.userId) return `u:${viewer.userId}`;
  if (viewer.guestToken) return `g:${viewer.guestToken}`;
  const forwarded = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  return `ip:${forwarded ?? "unknown"}`;
}
