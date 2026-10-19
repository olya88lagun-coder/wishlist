import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { POST } from "./route";
import { costMicroRub, priceFor } from "@/server/ai-budget";

const mocks = vi.hoisted(() => ({ reserve: vi.fn(), settle: vi.fn(), record: vi.fn(), viewer: vi.fn(), allow: vi.fn(), fetch: vi.fn() }));
vi.mock("@wishlist/db", () => ({ reserveAiQuota: mocks.reserve, settleAiQuota: mocks.settle, recordAiUsage: mocks.record }));
vi.mock("@/server/db", () => ({ getDb: () => "test-db" }));
vi.mock("@/server/env", () => ({ getEnv: () => ({ SESSION_SECRET: "local-quota-api-test-secret-at-least-32" }) }));
vi.mock("@/server/viewer", () => ({ readViewer: mocks.viewer }));
vi.mock("@/server/rate-limit", () => ({ giftAiLimiter: { allow: mocks.allow } }));

const id = "d486087b-32a0-4ea3-8368-b0fa57c56571";
const ideas = ["Секатор", "Лейка", "Грабли"].map((title) => ({ title, reason: "Для работы в саду", type: "хобби", searchQuery: `${title} для сада` }));
const payload = (content = JSON.stringify({ ideas })) => ({ choices: [{ message: { content } }], usage: { prompt_tokens: 100, completion_tokens: 30 } });
const request = () => new Request("http://localhost/api/gifts/recommend", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.20" }, body: JSON.stringify({ person: "mom", occasion: "birthday", budget: "3000", interests: "сад" }) });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("ROUTERAI_API_KEY", "fake-local-key");
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("AI_DAILY_LIMIT_GUEST", "5");
  mocks.viewer.mockResolvedValue({ user: null, viewer: { userId: null, guestToken: "guest-one" } });
  mocks.allow.mockReturnValue(true);
  mocks.reserve.mockResolvedValue({ allowed: true, reservationId: id });
  mocks.fetch.mockResolvedValue(Response.json(payload()));
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

test("reserves before the provider call, links usage and releases only known unused cost", async () => {
  mocks.fetch.mockImplementation(async () => { expect(mocks.reserve).toHaveBeenCalledOnce(); return Response.json(payload()); });
  expect((await POST(request())).status).toBe(200);
  expect(mocks.reserve.mock.calls[0]![1]).toMatchObject({ clientLimit: 5, networkLimit: 5, signedIn: false });
  expect(mocks.record.mock.calls[0]![1]).toMatchObject({ requestId: id, attempt: 1 });
  expect(mocks.settle).toHaveBeenCalledWith("test-db", id, costMicroRub({ inputTokens: 100, outputTokens: 30, reasoningTokens: 0 }, priceFor("routerai", "openai/gpt-oss-120b")));
});

test.each(["client_daily_limit", "network_daily_limit", "daily_budget"])("a rejected %s quota never calls the provider", async (reason) => {
  mocks.reserve.mockResolvedValue({ allowed: false, reason });
  expect((await POST(request())).status).toBe(reason === "daily_budget" ? 503 : 429);
  expect(mocks.fetch).not.toHaveBeenCalled();
  expect(mocks.settle).not.toHaveBeenCalled();
});

test("rotating the guest cookie leaves the independent network bucket unchanged", async () => {
  await POST(request());
  mocks.viewer.mockResolvedValue({ user: null, viewer: { userId: null, guestToken: "guest-two" } });
  await POST(request());
  const first = mocks.reserve.mock.calls[0]![1];
  const second = mocks.reserve.mock.calls[1]![1];
  expect(first.clientHash).not.toBe(second.clientHash);
  expect(first.networkHash).toBe(second.networkHash);
});

test("a transport failure keeps the full reservation charged", async () => {
  mocks.fetch.mockRejectedValue(new Error("offline"));
  expect((await POST(request())).status).toBe(502);
  expect(mocks.settle).toHaveBeenCalledWith("test-db", id, mocks.reserve.mock.calls[0]![1].reserveMicroRub);
});

test("an invalid JSON first response can retry but cannot release unknown provider cost", async () => {
  mocks.fetch.mockResolvedValueOnce(new Response("not-json")).mockResolvedValueOnce(Response.json(payload()));
  expect((await POST(request())).status).toBe(200);
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  expect(mocks.reserve).toHaveBeenCalledOnce();
  expect(mocks.settle).toHaveBeenCalledWith("test-db", id, mocks.reserve.mock.calls[0]![1].reserveMicroRub);
});

test("an unconfigured provider does not consume a database reservation", async () => {
  vi.stubEnv("ROUTERAI_API_KEY", "");
  expect((await POST(request())).status).toBe(503);
  expect(mocks.reserve).not.toHaveBeenCalled();
  expect(mocks.fetch).not.toHaveBeenCalled();
});

test("a returned model alias uses the same configured tariff as admission", async () => {
  mocks.fetch.mockResolvedValue(Response.json({ ...payload(), model: "alias-not-in-pricelist" }));
  expect((await POST(request())).status).toBe(200);
  expect(mocks.settle).toHaveBeenCalledWith("test-db", id, costMicroRub({ inputTokens: 100, outputTokens: 30, reasoningTokens: 0 }, priceFor("routerai", "openai/gpt-oss-120b")));
});

test("the initial timeout covers a stalled response body, then permits the bounded retry", async () => {
  vi.useFakeTimers();
  mocks.fetch.mockImplementationOnce(async (_url, options) => ({ ok: true, status: 200, json: () => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(new Error("aborted body")), { once: true });
  }) })).mockResolvedValueOnce(Response.json(payload()));
  const running = POST(request());
  await vi.waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce());
  await vi.advanceTimersByTimeAsync(20_000);
  expect((await running).status).toBe(200);
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  expect(mocks.settle).toHaveBeenCalledWith("test-db", id, mocks.reserve.mock.calls[0]![1].reserveMicroRub);
});
