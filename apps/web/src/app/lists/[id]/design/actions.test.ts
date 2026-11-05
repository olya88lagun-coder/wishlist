import { beforeEach, expect, test, vi } from "vitest";

let providers: string[];
vi.mock("@/server/viewer", () => ({ requireUser: async () => ({ id: "u1", providers, isAnonymous: providers.length === 0 }) }));
vi.mock("@/server/design-payments", () => ({ createDesignCheckout: vi.fn(async () => "https://pay.example/checkout"), refreshDesignPayment: vi.fn() }));
vi.mock("@/server/db", () => ({ getDb: () => ({}) }));
vi.mock("@/server/free-designs", () => ({ freeDesignTelegramIds: () => [] }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
import { createDesignCheckout } from "@/server/design-payments";
import { checkoutDesignAction } from "./actions";

function paidForm() {
  const form = new FormData();
  form.set("product", "new_year"); form.set("email", "a@b.ru"); form.set("consent", "on");
  return form;
}

beforeEach(() => { vi.clearAllMocks(); });

test("a participant without login cannot pay: anonymous data is deleted after the game", async () => {
  providers = [];
  const state = await checkoutDesignAction("w1", { message: "" }, paidForm());
  expect(state.message).toMatch(/Войдите/);
  expect(createDesignCheckout).not.toHaveBeenCalled();
});

test("a signed-in owner goes to the payment page", async () => {
  providers = ["telegram"];
  await expect(checkoutDesignAction("w1", { message: "" }, paidForm())).rejects.toThrow("redirect:https://pay.example/checkout");
});
