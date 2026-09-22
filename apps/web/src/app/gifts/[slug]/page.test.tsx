import { Children, isValidElement, type ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/server/viewer", () => ({
  readViewer: vi.fn().mockResolvedValue({ user: null }),
}));

vi.mock("@/server/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("@wishlist/db", () => ({
  listWishlistsForOwner: vi.fn(),
}));

import GiftRecipientPage from "./page";

function collectImageSources(node: ReactNode, sources: string[] = []): string[] {
  if (!isValidElement<{ src?: unknown; children?: ReactNode }>(node)) return sources;

  if (typeof node.props.src === "string" && node.props.src.startsWith("/gifts/seo/")) {
    sources.push(node.props.src);
  }

  Children.forEach(node.props.children, (child) => collectImageSources(child, sources));
  return sources;
}

describe("gift recipient editorial images", () => {
  test.each([
    ["for-dad", ["/gifts/seo/dad-1.webp", "/gifts/seo/dad-2.webp", "/gifts/seo/dad-3.webp"]],
    ["for-girlfriend", ["/gifts/seo/girlfriend-1.webp", "/gifts/seo/girlfriend-2.webp", "/gifts/seo/girlfriend-3.webp"]],
    ["for-boyfriend", ["/gifts/seo/boyfriend-1.webp", "/gifts/seo/boyfriend-2.webp", "/gifts/seo/boyfriend-3.webp"]],
    ["new-year", ["/gifts/seo/new-year-1.webp", "/gifts/seo/new-year-2.webp", "/gifts/seo/new-year-3.webp"]],
  ])("uses the dedicated image series for %s", async (slug, expectedSources) => {
    const page = await GiftRecipientPage({ params: Promise.resolve({ slug }) });

    expect(collectImageSources(page)).toEqual(expectedSources);
  });
});
