import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { OwnerPageHeader } from "./OwnerPageHeader";

describe("OwnerPageHeader", () => {
  test("gives the owner page one labelled hero with context and actions", () => {
    const html = renderToStaticMarkup(
      <OwnerPageHeader
        eyebrow="Личное пространство"
        title={<>Мои <i>списки</i></>}
        description="Все желания и праздники — в одном месте."
        actions={<a href="/me">Профиль</a>}
      />,
    );

    expect(html).toContain('<header class="owner-hero" aria-labelledby="owner-page-title">');
    expect(html).toContain('<h1 id="owner-page-title" class="owner-hero__title">Мои <i>списки</i></h1>');
    expect(html).toContain("Все желания и праздники — в одном месте.");
    expect(html).toContain('href="/me"');
  });
});
