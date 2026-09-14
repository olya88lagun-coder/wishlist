import { jwtVerify, SignJWT } from "jose";

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
export const OAUTH_STATE_TTL_SECONDS = 600;

const SESSION_AUDIENCE = "session";
const OAUTH_AUDIENCE = "oauth-state";

export type OAuthStatePayload = { state: string; codeVerifier: string; linkUserId: string | null };

const key = (secret: string) => new TextEncoder().encode(secret);

export async function signSession(userId: string, secret: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(key(secret));
}

export async function verifySession(token: string, secret: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { audience: SESSION_AUDIENCE, algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
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
    return { state, codeVerifier, linkUserId: typeof linkUserId === "string" ? linkUserId : null };
  } catch {
    return null;
  }
}
