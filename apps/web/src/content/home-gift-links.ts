// Блок «Подборки подарков» на главной. Ссылки видны в самом тексте страницы, а не только в выпадающем меню:
// так поисковик быстрее находит подборки, а человек может перейти к нужной с главной.
// Тест на главной следит, чтобы каждая страница /gifts/... из sitemap была здесь или в меню.
export type HomeGiftLink = { label: string; href: string };
export type HomeGiftLinkGroup = { title: string; links: readonly HomeGiftLink[] };

export const HOME_GIFT_LINK_GROUPS: readonly HomeGiftLinkGroup[] = [
  {
    title: "По поводу",
    links: [
      { label: "Подарки на день рождения", href: "/gifts/birthday" },
      { label: "Подарки на Новый год", href: "/gifts/new-year" },
      { label: "Подарки на свадьбу", href: "/gifts/wedding" },
      { label: "Подарки на годовщину", href: "/gifts/anniversary" },
      { label: "Подарки на новоселье", href: "/gifts/housewarming" },
      { label: "Подарки на 14 февраля", href: "/gifts/valentines-day" },
      { label: "Подарки на 23 февраля", href: "/gifts/february-23" },
      { label: "Подарки на 8 Марта", href: "/gifts/march-8" },
      { label: "Подарки на Тайного Санту", href: "/gifts/secret-santa" },
    ],
  },
  {
    title: "Кому подарить",
    links: [
      { label: "Подарки маме", href: "/gifts/for-mom" },
      { label: "Подарки папе", href: "/gifts/for-dad" },
      { label: "Подарки девушке", href: "/gifts/for-girlfriend" },
      { label: "Подарки парню", href: "/gifts/for-boyfriend" },
      { label: "Подарки жене", href: "/gifts/for-wife" },
      { label: "Подарки мужу", href: "/gifts/for-husband" },
      { label: "Подарки другу или подруге", href: "/gifts/for-friend" },
      { label: "Подарки коллеге", href: "/gifts/for-colleague" },
      { label: "Подарки сестре", href: "/gifts/for-sister" },
      { label: "Подарки брату", href: "/gifts/for-brother" },
      { label: "Подарки бабушке", href: "/gifts/for-grandma" },
      { label: "Подарки дедушке", href: "/gifts/for-grandpa" },
      { label: "Подарки дочери", href: "/gifts/for-daughter" },
      { label: "Подарки сыну", href: "/gifts/for-son" },
      { label: "Подарки учителю", href: "/gifts/for-teacher" },
      { label: "Подарки руководителю", href: "/gifts/for-boss" },
    ],
  },
  {
    title: "Детям по возрасту",
    links: [
      { label: "Подарки детям до 7 лет", href: "/gifts/for-children" },
      { label: "Ребёнку до года", href: "/gifts/for-child-under-1" },
      { label: "Ребёнку на 1 год", href: "/gifts/for-child-1-year" },
      { label: "Ребёнку на 2 года", href: "/gifts/for-child-2-years" },
      { label: "Ребёнку на 3 года", href: "/gifts/for-child-3-years" },
      { label: "Ребёнку на 4 года", href: "/gifts/for-child-4-years" },
      { label: "Ребёнку на 5 лет", href: "/gifts/for-child-5-years" },
      { label: "Ребёнку на 6 лет", href: "/gifts/for-child-6-years" },
      { label: "Ребёнку на 7 лет", href: "/gifts/for-child-7-years" },
    ],
  },
  {
    title: "По бюджету",
    links: [
      { label: "Подарки до 1 000 ₽", href: "/gifts/under-1000" },
      { label: "Подарки до 3 000 ₽", href: "/gifts/under-3000" },
      { label: "Подарки до 5 000 ₽", href: "/gifts/under-5000" },
      { label: "Подарки до 10 000 ₽", href: "/gifts/under-10000" },
      { label: "Подарки до 15 000 ₽", href: "/gifts/under-15000" },
      { label: "Подарки до 20 000 ₽", href: "/gifts/under-20000" },
    ],
  },
  {
    title: "По интересам",
    links: [
      { label: "Книги в подарок", href: "/gifts/books" },
      { label: "Подарки для спорта и отдыха", href: "/gifts/sport" },
    ],
  },
];
