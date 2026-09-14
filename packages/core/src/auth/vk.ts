import { createHash, randomBytes } from "node:crypto";

export const VK_ID_HOST = "https://id.vk.ru";
const VK_SCOPE = "vkid.personal_info";
const FORM_HEADERS = { "content-type": "application/x-www-form-urlencoded" };

export type FetchFn = (input: string, init: RequestInit) => Promise<Response>;
export type VkUser = { id: string; firstName: string; lastName: string | null; avatarUrl: string | null };

export function createPkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(48).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function buildVkAuthorizeUrl(p: { clientId: string; redirectUri: string; state: string; codeChallenge: string }): string {
  const url = new URL("/authorize", VK_ID_HOST);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    state: p.state,
    code_challenge: p.codeChallenge,
    code_challenge_method: "S256",
    scope: VK_SCOPE,
  }).toString();
  return url.toString();
}

async function postForm(fetchFn: FetchFn, path: string, form: Record<string, string>): Promise<Record<string, unknown>> {
  const response = await fetchFn(`${VK_ID_HOST}${path}`, {
    method: "POST",
    headers: FORM_HEADERS,
    body: new URLSearchParams(form).toString(),
  });
  return (await response.json()) as Record<string, unknown>;
}

export async function exchangeVkCode(p: {
  clientId: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
  deviceId: string;
  state: string;
  fetchFn: FetchFn;
}): Promise<{ ok: true; accessToken: string } | { ok: false; error: string }> {
  const body = await postForm(p.fetchFn, "/oauth2/auth", {
    grant_type: "authorization_code",
    code: p.code,
    code_verifier: p.codeVerifier,
    client_id: p.clientId,
    device_id: p.deviceId,
    redirect_uri: p.redirectUri,
    state: p.state,
  });
  if (typeof body.access_token === "string") return { ok: true, accessToken: body.access_token };
  return { ok: false, error: typeof body.error === "string" ? body.error : "token_exchange_failed" };
}

export async function fetchVkUser(p: {
  clientId: string;
  accessToken: string;
  fetchFn: FetchFn;
}): Promise<{ ok: true; user: VkUser } | { ok: false; error: string }> {
  const body = await postForm(p.fetchFn, "/oauth2/user_info", { access_token: p.accessToken, client_id: p.clientId });
  const user = body.user as Record<string, unknown> | undefined;
  const id = user?.user_id;
  if (!user || (typeof id !== "string" && typeof id !== "number") || typeof user.first_name !== "string") {
    return { ok: false, error: "malformed_user_info" };
  }
  const optional = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : null);
  return {
    ok: true,
    user: { id: String(id), firstName: user.first_name, lastName: optional(user.last_name), avatarUrl: optional(user.avatar) },
  };
}
