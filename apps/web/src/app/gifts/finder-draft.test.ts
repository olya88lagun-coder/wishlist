import { describe, expect, test } from "vitest";
import { pendingFinderPath, readFinderDraft } from "./finder-draft";

const now = 1_000_000_000;
const draft = { path: "/gifts/under-1000", savedAt: now, person: "other", occasion: "birthday", interests: "Книги и чай", budget: "1000", customBudget: "", results: [{ title: "Книга", reason: "Для чтения", type: "хобби", searchQuery: "книга приключения" }], selectedTitle: "Книга" };

describe("finder draft", () => {
  test("restores the original idea, form and selected result", () => {
    expect(readFinderDraft(JSON.stringify(draft), draft.path, now + 60_000)).toEqual(draft);
  });
  test("does not replace defaults on another gift page", () => {
    expect(readFinderDraft(JSON.stringify(draft), "/gifts/for-mom", now)).toBeNull();
  });
  test("recovers a safe continuation on a login retry, only while the draft is valid", () => {
    expect(pendingFinderPath(JSON.stringify(draft), now)).toBe(draft.path);
    expect(pendingFinderPath(JSON.stringify(draft), now + 30 * 60_000 + 1)).toBeNull();
    expect(pendingFinderPath(JSON.stringify({ ...draft, path: "//evil.example" }), now)).toBeNull();
  });
  test.each([now - 1, now + 30 * 60_000 + 1])("rejects future or expired timestamps at %s", (time) => {
    expect(readFinderDraft(JSON.stringify(draft), draft.path, time)).toBeNull();
  });
  test.each([null, "broken", "null", JSON.stringify({ ...draft, results: [null] }), JSON.stringify({ ...draft, selectedTitle: "missing" }), JSON.stringify({ ...draft, interests: "x".repeat(2001) }), "x".repeat(32_001)])("ignores malformed or oversized tab storage", (raw) => {
    expect(readFinderDraft(raw, draft.path, now)).toBeNull();
  });
});
