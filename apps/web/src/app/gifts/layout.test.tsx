import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import GiftsLayout from "./layout";

describe("gift pages layout", () => {
  test("renders the shared site menu above gift and article-style pages", () => {
    const html = renderToStaticMarkup(
      <GiftsLayout>
        <main>Gift content</main>
      </GiftsLayout>,
    );

    expect(html).toContain('href="/"');
    expect(html).toContain("Главная");
    expect(html).toContain("<summary>Статьи");
    expect(html).toContain('href="/articles"');
    expect(html).toContain("Как это работает");
  });
});
