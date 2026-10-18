import { giftReturnPath } from "@/lib/gift-return-path";

export type GiftIdea = { title: string; reason: string; type: string; searchQuery: string };
export type FinderDraft = {
  path: string; savedAt: number; person: string; occasion: string; interests: string;
  budget: string; customBudget: string; results: GiftIdea[]; selectedTitle: string;
};
export const FINDER_DRAFT_KEY = "wl_gift_finder_draft_v1";
const MAX_AGE = 30 * 60 * 1000;
const text = (value: unknown, max: number): value is string => typeof value === "string" && value.length <= max;

export function readFinderDraft(raw: string | null, path: string, now = Date.now()): FinderDraft | null {
  if (!raw || raw.length > 32_000) return null;
  try {
    const draft = JSON.parse(raw) as FinderDraft;
    if (!draft || !giftReturnPath(draft.path) || draft.path !== path || !Number.isFinite(draft.savedAt) || now < draft.savedAt || now - draft.savedAt > MAX_AGE) return null;
    if (!text(draft.person, 30) || !text(draft.occasion, 30) || !text(draft.interests, 2000) || !text(draft.budget, 30) || !text(draft.customBudget, 30) || !text(draft.selectedTitle, 200)) return null;
    if (!Array.isArray(draft.results) || draft.results.length > 12 || !draft.results.every((idea) => idea && text(idea.title, 200) && text(idea.reason, 2000) && text(idea.type, 100) && text(idea.searchQuery, 500))) return null;
    if (!draft.results.some((idea) => idea.title === draft.selectedTitle)) return null;
    return draft;
  } catch { return null; }
}

export function pendingFinderPath(raw: string | null, now = Date.now()): string | null {
  if (!raw || raw.length > 32_000) return null;
  try {
    const path = giftReturnPath(JSON.parse(raw)?.path);
    return path && readFinderDraft(raw, path, now) ? path : null;
  } catch { return null; }
}
