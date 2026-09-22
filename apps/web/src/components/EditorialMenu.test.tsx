import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { EditorialMenu } from "./EditorialMenu";

const EXPECTED_LINKS = [
  "/articles",
  "/articles/kak-sostavit-vishlist",
  "/articles/chto-podarit-mame-na-den-rozhdeniya",
  "/articles/idei-podarkov-na-den-rozhdeniya",
  "/articles/podarki-do-3000-rubley",
  "/gifts/for-mom", "/gifts/for-dad", "/gifts/for-girlfriend", "/gifts/for-boyfriend",
  "/gifts/for-wife", "/gifts/for-husband", "/gifts/for-friend", "/gifts/for-sister",
  "/gifts/for-brother", "/gifts/for-grandma", "/gifts/for-grandpa", "/gifts/for-daughter",
  "/gifts/for-son", "/gifts/for-teacher", "/gifts/for-boss", "/gifts/for-colleague",
  "/gifts/birthday", "/gifts/new-year", "/gifts/wedding", "/gifts/anniversary",
  "/gifts/housewarming", "/gifts/valentines-day", "/gifts/march-8", "/gifts/february-23",
  "/gifts/secret-santa", "/gifts/under-1000", "/gifts/under-3000", "/gifts/under-5000",
  "/gifts/under-10000", "/gifts/under-15000", "/gifts/under-20000",
] as const;

describe("EditorialMenu", () => {
  test("offers every published article and gift SEO page from the main menu", () => {
    const html = renderToStaticMarkup(<EditorialMenu />);

    expect(html).toContain("<summary>Статьи");
    expect(html).not.toContain("Каталог");
    for (const href of EXPECTED_LINKS) expect(html).toContain(`href="${href}"`);
  });
});
