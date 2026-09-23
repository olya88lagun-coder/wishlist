import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import ArticlesLayout from "./layout";

describe("articles layout navigation", () => {
  test("links back to the real home page sections", () => {
    const html = renderToStaticMarkup(
      <ArticlesLayout>
        <main>Article content</main>
      </ArticlesLayout>,
    );

    expect(html).toContain('href="/"');
    expect(html).toContain("Главная");
    expect(html).toContain("Статьи");
    expect(html).toContain('href="/#how"');
    expect(html).not.toContain('/#how-it-works');
  });
});