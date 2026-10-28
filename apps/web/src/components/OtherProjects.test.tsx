import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { OTHER_PROJECTS, otherProjectUrl } from "@/content/other-projects";
import { OtherProjects } from "./OtherProjects";
import { SiteFooter } from "./SiteFooter";

describe("other projects", () => {
  test("links carry the placement in utm tags and point to our own sites", () => {
    expect(otherProjectUrl(OTHER_PROJECTS[0]!, "article")).toBe(
      "https://grani-test.ru/?utm_source=wishlist&utm_medium=article&utm_campaign=other_projects",
    );
    expect(otherProjectUrl(OTHER_PROJECTS[1]!, "footer")).toContain("https://tvoy-orakul.ru/");
  });

  test("the block shows both projects, opens them in a new tab and is not labelled as advertising", () => {
    const html = renderToStaticMarkup(<OtherProjects placement="home" />);
    expect(html).toContain("Грани");
    expect(html).toContain("Твой оракул");
    expect(html).toContain("utm_medium=home");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toMatch(/Реклама|erid/);
  });

  test("the footer links both projects with the footer tag", () => {
    const html = renderToStaticMarkup(<SiteFooter botUsername="bot" />);
    expect(html).toContain("Другие проекты автора");
    expect(html).toContain("utm_medium=footer");
    expect(html.match(/utm_campaign=other_projects/g)).toHaveLength(2);
  });
});
