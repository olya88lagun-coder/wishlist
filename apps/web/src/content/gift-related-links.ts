import { HOME_GIFT_LINK_GROUPS, type HomeGiftLink } from "./home-gift-links";

// Ссылки, которые есть на любой подборке: самые частые поводы и бюджет
const CROSS_LINKS = ["/gifts/birthday", "/gifts/new-year", "/gifts/under-5000"] as const;

// Соседние подборки той же группы (повод, получатель, бюджет, интерес) плюс несколько общих.
// Раньше на всех подборках стоял один и тот же набор из пяти ссылок: поиску не из чего понять, как страницы связаны по смыслу.
export function relatedGiftLinks(slug: string): HomeGiftLink[] {
  const href = `/gifts/${slug}`;
  const group = HOME_GIFT_LINK_GROUPS.find((candidate) => candidate.links.some((link) => link.href === href));
  const siblings = (group?.links ?? []).filter((link) => link.href !== href);
  const cross = HOME_GIFT_LINK_GROUPS.flatMap((candidate) => candidate.links).filter(
    (link) => (CROSS_LINKS as readonly string[]).includes(link.href) && link.href !== href && !siblings.some((sibling) => sibling.href === link.href),
  );
  return [...siblings, ...cross];
}
