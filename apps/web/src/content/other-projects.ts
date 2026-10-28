export type OtherProjectPlacement = "footer" | "article" | "home";

export type OtherProject = {
  id: "grani" | "oracle";
  name: string;
  site: string;
  summary: string;
};

// Свои проекты автора на собственном сайте: это не реклама третьих лиц, поэтому без «Реклама» и erid.
export const OTHER_PROJECTS: readonly OtherProject[] = [
  {
    id: "grani",
    name: "Грани",
    site: "grani-test.ru",
    summary: "Бесплатный тест личности по модели Big Five: 50 утверждений, около 10 минут. Результат открывается после входа через VK ID.",
  },
  {
    id: "oracle",
    name: "Твой оракул",
    site: "tvoy-orakul.ru",
    summary: "Матрица судьбы, совместимость, Лила и таро как инструменты самопознания, без обещаний предсказать будущее.",
  },
];

export function otherProjectUrl(project: OtherProject, placement: OtherProjectPlacement): string {
  const params = new URLSearchParams({ utm_source: "wishlist", utm_medium: placement, utm_campaign: "other_projects" });
  return `https://${project.site}/?${params.toString()}`;
}
