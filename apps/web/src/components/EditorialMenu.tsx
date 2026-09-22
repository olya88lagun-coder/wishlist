import Link from "next/link";
import { ARTICLES } from "@/content/articles";

const RECIPIENT_LINKS = [
  ["Маме", "/gifts/for-mom"], ["Папе", "/gifts/for-dad"],
  ["Девушке", "/gifts/for-girlfriend"], ["Парню", "/gifts/for-boyfriend"],
  ["Жене", "/gifts/for-wife"], ["Мужу", "/gifts/for-husband"],
  ["Другу или подруге", "/gifts/for-friend"], ["Сестре", "/gifts/for-sister"],
  ["Брату", "/gifts/for-brother"], ["Бабушке", "/gifts/for-grandma"],
  ["Дедушке", "/gifts/for-grandpa"], ["Дочери", "/gifts/for-daughter"],
  ["Сыну", "/gifts/for-son"], ["Учителю", "/gifts/for-teacher"],
  ["Руководителю", "/gifts/for-boss"], ["Коллеге", "/gifts/for-colleague"],
] as const;

const OCCASION_LINKS = [
  ["День рождения", "/gifts/birthday"], ["Новый год", "/gifts/new-year"],
  ["Свадьба", "/gifts/wedding"], ["Годовщина", "/gifts/anniversary"],
  ["Новоселье", "/gifts/housewarming"], ["14 февраля", "/gifts/valentines-day"],
  ["8 Марта", "/gifts/march-8"], ["23 Февраля", "/gifts/february-23"],
  ["Тайный Санта", "/gifts/secret-santa"],
] as const;

const BUDGET_LINKS = [
  ["До 1 000 ₽", "/gifts/under-1000"], ["До 3 000 ₽", "/gifts/under-3000"],
  ["До 5 000 ₽", "/gifts/under-5000"], ["До 10 000 ₽", "/gifts/under-10000"],
  ["До 15 000 ₽", "/gifts/under-15000"], ["До 20 000 ₽", "/gifts/under-20000"],
] as const;

function MenuGroup({ title, links }: { title: string; links: readonly (readonly [string, string])[] }) {
  return (
    <section className="editorial-menu__group">
      <p>{title}</p>
      <div>{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</div>
    </section>
  );
}

export function EditorialMenu() {
  return (
    <details className="editorial-menu">
      <summary>Статьи <span aria-hidden="true">⌄</span></summary>
      <div className="editorial-menu__panel">
        <section className="editorial-menu__group editorial-menu__group--articles">
          <p>Журнал</p>
          <div>
            <Link className="editorial-menu__all" href="/articles">Все статьи →</Link>
            {ARTICLES.map((article) => <Link key={article.slug} href={`/articles/${article.slug}`}>{article.title}</Link>)}
          </div>
        </section>
        <MenuGroup title="Кому" links={RECIPIENT_LINKS} />
        <MenuGroup title="По поводу" links={OCCASION_LINKS} />
        <MenuGroup title="По бюджету" links={BUDGET_LINKS} />
      </div>
    </details>
  );
}
