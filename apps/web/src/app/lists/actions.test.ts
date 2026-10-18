import { createTestDb } from "@wishlist/db/testing";
import { listWishlistsForOwner, upsertUserFromIdentity, type Database } from "@wishlist/db";
import { beforeEach, expect, test, vi } from "vitest";
import { initialFormState } from "./form-state";

let db: Database;
let ownerId: string;
vi.mock("@/server/db", () => ({ getDb: () => db }));
vi.mock("@/server/viewer", () => ({ requireUser: () => ({ id: ownerId }), clientKey: () => "test" }));
vi.mock("@/server/analytics-completion", () => ({ recordCompletion: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
import { recordCompletion } from "@/server/analytics-completion";
import { createListAction } from "./actions";

beforeEach(async () => {
  vi.clearAllMocks();
  db = await createTestDb();
  ownerId = (await upsertUserFromIdentity(db, { provider: "telegram", providerUserId: "42", displayName: "Имя", avatarUrl: null })).id;
});
test("records completion after the list exists and preserves its continuation", async () => {
  const form = new FormData();
  form.set("title", "Частный список"); form.set("occasion", "birthday"); form.set("returnTo", "/gifts/under-1000");
  await expect(createListAction(initialFormState, form)).rejects.toThrow("redirect:/gifts/under-1000");
  expect(await listWishlistsForOwner(db, ownerId)).toHaveLength(1);
  expect(recordCompletion).toHaveBeenCalledExactlyOnceWith({ event: "wishlist_created", params: { source: "finder" } });
});
test("does not record a rejected list form", async () => {
  expect((await createListAction(initialFormState, new FormData())).status).toBe("error");
  expect(recordCompletion).not.toHaveBeenCalled();
  expect(await listWishlistsForOwner(db, ownerId)).toHaveLength(0);
});
