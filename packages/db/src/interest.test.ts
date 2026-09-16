import { beforeEach, expect, test } from "vitest";
import { countInterest, FEATURE_THEMES, hasInterest, registerInterest } from "./interest";
import { createTestDb } from "./testing";
import { createUserFixture } from "./test-fixtures";
import type { Database } from "./types";

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
});

test("one vote per user, counted across users", async () => {
  const masha = await createUserFixture(db, "Маша");
  const olya = await createUserFixture(db, "Оля");
  expect(await hasInterest(db, masha, FEATURE_THEMES)).toBe(false);
  expect(await registerInterest(db, masha, FEATURE_THEMES)).toBe("added");
  expect(await registerInterest(db, masha, FEATURE_THEMES)).toBe("already");
  expect(await registerInterest(db, olya, FEATURE_THEMES)).toBe("added");
  expect(await hasInterest(db, masha, FEATURE_THEMES)).toBe(true);
  expect(await countInterest(db, FEATURE_THEMES)).toBe(2);
});
