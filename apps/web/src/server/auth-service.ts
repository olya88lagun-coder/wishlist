import { randomBytes } from "node:crypto";
import {
  buildVkAuthorizeUrl,
  createPkcePair,
  exchangeVkCode,
  type FetchFn,
  fetchVkUser,
  signOAuthState,
  signSession,
  type TelegramUser,
  verifyOAuthState,
  verifySession,
  verifyTelegramInitData,
  verifyTelegramLoginWidget,
} from "@wishlist/core";
import {
  type Database,
  getUserWithIdentities,
  type IdentityInput,
  linkIdentity,
  upsertUserFromIdentity,
  type UserWithIdentities,
} from "@wishlist/db";
import type { AppEnv } from "./env";
import { giftReturnPath } from "@/lib/gift-return-path";

export type AuthDeps = { db: Database; env: AppEnv; now: () => Date; fetchFn: FetchFn };
export type AuthOutcome = { ok: true; sessionToken: string; userId: string; returnTo?: string } | { ok: false; error: string };

const vkRedirectUri = (env: AppEnv) => new URL("/api/auth/vk/callback", env.APP_URL).toString();

function telegramIdentity(user: TelegramUser): IdentityInput {
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return { provider: "telegram", providerUserId: String(user.id), displayName, avatarUrl: user.photoUrl };
}

async function loginOrLink(deps: AuthDeps, identity: IdentityInput, currentSessionToken: string | null): Promise<AuthOutcome> {
  const currentUserId = currentSessionToken ? await verifySession(currentSessionToken, deps.env.SESSION_SECRET) : null;
  if (currentUserId && (await getUserWithIdentities(deps.db, currentUserId))) {
    const linked = await linkIdentity(deps.db, currentUserId, identity);
    if (!linked.ok) return { ok: false, error: `link_${linked.reason}` };
    return { ok: true, userId: currentUserId, sessionToken: await signSession(currentUserId, deps.env.SESSION_SECRET) };
  }
  const user = await upsertUserFromIdentity(deps.db, identity);
  return { ok: true, userId: user.id, sessionToken: await signSession(user.id, deps.env.SESSION_SECRET) };
}

export async function loginWithTelegramInitData(deps: AuthDeps, initData: string): Promise<AuthOutcome> {
  const verified = verifyTelegramInitData(initData, deps.env.TELEGRAM_BOT_TOKEN, deps.now());
  if (!verified.ok) return { ok: false, error: `telegram_${verified.reason}` };
  const user = await upsertUserFromIdentity(deps.db, telegramIdentity(verified.user));
  return { ok: true, userId: user.id, sessionToken: await signSession(user.id, deps.env.SESSION_SECRET) };
}

export async function startTelegramLogin(deps: AuthDeps, currentSessionToken: string | null, returnTo?: string | null) {
  const state = randomBytes(24).toString("base64url");
  const linkUserId = currentSessionToken ? await verifySession(currentSessionToken, deps.env.SESSION_SECRET) : null;
  const target = giftReturnPath(returnTo);
  const stateCookie = await signOAuthState({ state, codeVerifier: "telegram-widget", linkUserId, ...(target ? { returnTo: target } : {}) }, deps.env.SESSION_SECRET);
  const authUrl = new URL("/api/auth/telegram/widget", deps.env.APP_URL);
  authUrl.searchParams.set("state", state);
  return { authUrl: authUrl.toString(), stateCookie };
}

export async function loginWithTelegramWidget(
  deps: AuthDeps,
  params: URLSearchParams,
  currentSessionToken: string | null,
  stateCookie: string | null = null,
): Promise<AuthOutcome> {
  const saved = stateCookie ? await verifyOAuthState(stateCookie, deps.env.SESSION_SECRET) : null;
  const currentUserId = currentSessionToken ? await verifySession(currentSessionToken, deps.env.SESSION_SECRET) : null;
  if (!saved || saved.codeVerifier !== "telegram-widget" || saved.state !== params.get("state") || saved.linkUserId !== currentUserId) {
    return { ok: false, error: "telegram_state_mismatch" };
  }
  const telegramParams = new URLSearchParams(params);
  telegramParams.delete("state");
  const verified = verifyTelegramLoginWidget(telegramParams, deps.env.TELEGRAM_BOT_TOKEN, deps.now());
  if (!verified.ok) return { ok: false, error: `telegram_${verified.reason}` };
  const result = await loginOrLink(deps, telegramIdentity(verified.user), currentSessionToken);
  const target = giftReturnPath(saved.returnTo);
  return result.ok && target ? { ...result, returnTo: target } : result;
}

export async function startVkLogin(
  deps: AuthDeps,
  currentSessionToken: string | null,
  returnTo?: string | null,
): Promise<{ redirectUrl: string; stateCookie: string }> {
  const { codeVerifier, codeChallenge } = createPkcePair();
  const state = randomBytes(24).toString("base64url");
  const linkUserId = currentSessionToken ? await verifySession(currentSessionToken, deps.env.SESSION_SECRET) : null;
  const target = giftReturnPath(returnTo);
  const stateCookie = await signOAuthState({ state, codeVerifier, linkUserId, ...(target ? { returnTo: target } : {}) }, deps.env.SESSION_SECRET);
  const redirectUrl = buildVkAuthorizeUrl({ clientId: deps.env.VK_CLIENT_ID, redirectUri: vkRedirectUri(deps.env), state, codeChallenge });
  return { redirectUrl, stateCookie };
}

export async function finishVkLogin(
  deps: AuthDeps,
  p: { code: string | null; deviceId: string | null; state: string | null; stateCookie: string | null; currentSessionToken: string | null },
): Promise<AuthOutcome> {
  if (!p.code || !p.deviceId || !p.state || !p.stateCookie) return { ok: false, error: "vk_missing_params" };
  const saved = await verifyOAuthState(p.stateCookie, deps.env.SESSION_SECRET);
  const currentUserId = p.currentSessionToken ? await verifySession(p.currentSessionToken, deps.env.SESSION_SECRET) : null;
  if (!saved || saved.codeVerifier === "telegram-widget" || saved.state !== p.state || saved.linkUserId !== currentUserId) return { ok: false, error: "vk_state_mismatch" };

  const token = await exchangeVkCode({
    clientId: deps.env.VK_CLIENT_ID,
    redirectUri: vkRedirectUri(deps.env),
    code: p.code,
    codeVerifier: saved.codeVerifier,
    deviceId: p.deviceId,
    state: p.state,
    fetchFn: deps.fetchFn,
  });
  if (!token.ok) return { ok: false, error: `vk_${token.error}` };

  const profile = await fetchVkUser({ clientId: deps.env.VK_CLIENT_ID, accessToken: token.accessToken, fetchFn: deps.fetchFn });
  if (!profile.ok) return { ok: false, error: `vk_${profile.error}` };

  const identity: IdentityInput = {
    provider: "vk",
    providerUserId: profile.user.id,
    displayName: [profile.user.firstName, profile.user.lastName].filter(Boolean).join(" "),
    avatarUrl: profile.user.avatarUrl,
  };
  const result = await loginOrLink(deps, identity, p.currentSessionToken);
  const target = giftReturnPath(saved.returnTo);
  return result.ok && target ? { ...result, returnTo: target } : result;
}

export async function getCurrentUser(
  deps: Pick<AuthDeps, "db" | "env">,
  sessionToken: string | null,
): Promise<UserWithIdentities | null> {
  if (!sessionToken) return null;
  const userId = await verifySession(sessionToken, deps.env.SESSION_SECRET);
  if (!userId) return null;
  return getUserWithIdentities(deps.db, userId);
}
