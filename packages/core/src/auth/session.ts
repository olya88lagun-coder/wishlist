import { jwtVerify, SignJWT } from "jose";

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
export const OAUTH_STATE_TTL_SECONDS = 600;

const SESSION_AUDIENCE = "session";
const OAUTH_AUDIENCE = "oauth-state";

export type OAuthStatePayload = { state: string; codeVerifier: string; linkUserId: string | null; returnTo?: string };

const key = (secret: string) => new TextEncoder().encode(secret);

export async function signSession(userId: string, secret: string, version = 0): Promise<string> {
  return new SignJWT({ v: version })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(key(secret));
}

export async function verifySession(token: string, secret: string): Promise<string | null> {
  return (await verifySessionClaims(token, secret))?.userId ?? null;
}

// Токены, выпущенные до появления версии, считаются версией 0
export async function verifySessionClaims(token: string, secret: string): Promise<{ userId: string; version: number } | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { audience: SESSION_AUDIENCE, algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") return null;
    return { userId: payload.sub, version: typeof payload.v === "number" ? payload.v : 0 };
  } catch {
    return null;
  }
}

export async function signOAuthState(payload: OAuthStatePayload, secret: string): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(OAUTH_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${OAUTH_STATE_TTL_SECONDS}s`)
    .sign(key(secret));
}

export async function verifyOAuthState(token: string, secret: string): Promise<OAuthStatePayload | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { audience: OAUTH_AUDIENCE, algorithms: ["HS256"] });
    const { state, codeVerifier, linkUserId } = payload;
    if (typeof state !== "string" || typeof codeVerifier !== "string") return null;
    return { state, codeVerifier, linkUserId: typeof linkUserId === "string" ? linkUserId : null,
      ...(typeof payload.returnTo === "string" ? { returnTo: payload.returnTo } : {}) };
  } catch {
    return null;
  }
}
