import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { costMicroRub, type ModelPrice } from "./ai-budget";

// Production web has no public port: Caddy is the final ingress hop (deploy/).
// Caddy appends the actual remote address; never trust a caller-supplied prefix.
// Missing/malformed headers share one bucket rather than bypassing the limit.
export function aiNetworkHash(headers: Headers, secret: string): string {
  const ip = headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  let network = "unknown";
  if (ip && !ip.includes("%")) {
    if (isIP(ip) === 4) network = ip;
    else if (isIP(ip) === 6) {
      const canonical = new URL(`http://[${ip}]`).hostname.slice(1, -1);
      const [left, right] = canonical.split("::");
      const a = left ? left.split(":") : [];
      const b = right ? right.split(":") : [];
      const groups = (right === undefined ? a : [...a, ...Array(8 - a.length - b.length).fill("0"), ...b]).map((part) => Number.parseInt(part, 16));
      network = groups.slice(0, 5).every((part) => part === 0) && groups[5] === 0xffff
        ? `${groups[6]! >> 8}.${groups[6]! & 255}.${groups[7]! >> 8}.${groups[7]! & 255}`
        : `${groups.slice(0, 4).map((part) => part.toString(16)).join(":")}::/64`;
    }
  }
  if (secret.length < 32) throw new Error("A session secret is required for AI network hashing");
  return createHmac("sha256", secret).update(`ai-network:${network}`).digest("hex").slice(0, 32);
}

export function guestNetworkLimit(guestLimit: number, env: Record<string, string | undefined> = process.env): number {
  const raw = env.AI_DAILY_LIMIT_GUEST_NETWORK;
  const value = raw?.trim() ? Number(raw) : NaN;
  return Number.isSafeInteger(value) && value >= 0 ? value : guestLimit;
}

// Admission uses configured model prices, as the existing daily budget does.
// Reserve input bytes plus framing overhead and twice the output cap, including
// reasoning headroom. Hold all three bounded attempts before the first request.
export function reservationCost(bodies: readonly Record<string, unknown>[], price: ModelPrice): number {
  return bodies.reduce((total, body) => total + Math.max(1, Math.ceil(costMicroRub({
    inputTokens: Buffer.byteLength(JSON.stringify(body), "utf8") + 1024,
    outputTokens: 2 * Number(body.max_output_tokens ?? body.max_tokens),
    reasoningTokens: 0,
  }, price))), 0);
}

export function hasBillableUsage(payload: unknown): boolean {
  const usage = (payload as { usage?: Record<string, unknown> } | null)?.usage;
  if (!usage || typeof usage !== "object") return false;
  const valid = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
  const chat = usage.prompt_tokens !== undefined || usage.completion_tokens !== undefined;
  const responses = usage.input_tokens !== undefined || usage.output_tokens !== undefined;
  const validPair = chat && responses
    ? valid(usage.prompt_tokens) && valid(usage.completion_tokens) && usage.prompt_tokens === usage.input_tokens && usage.completion_tokens === usage.output_tokens
    : chat ? valid(usage.prompt_tokens) && valid(usage.completion_tokens) : valid(usage.input_tokens) && valid(usage.output_tokens);
  return validPair
    && [usage.completion_tokens_details, usage.output_tokens_details].every((details) => {
      const reasoning = (details as { reasoning_tokens?: unknown } | null)?.reasoning_tokens;
      return reasoning === undefined || (valid(reasoning) && Number(reasoning) <= Number(chat ? usage.completion_tokens : usage.output_tokens));
    });
}
