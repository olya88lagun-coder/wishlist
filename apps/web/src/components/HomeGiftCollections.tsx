import Link from "next/link";
import { HOME_GIFT_LINK_GROUPS, type HomeGiftLink } from "@/content/home-gift-links";
import { isSantaSeason } from "./santa-season";

const featuredLimit = 5;
const seasonalPaths = ["/gifts/new-year", "/gifts/secret-santa"];

function GiftLinks({ links }: { links: readonly HomeGiftLink[] }) {
  return (
    <ul>
      {links.map((link) => (
        <li key={link.href}><Link href={link.href}>{link.label}</Link></li>
      ))}
    </ul>
  );
}

export function HomeGiftCollections() {
  const seasonal = isSantaSeason();
  return (
    <section className="home-section home-collections" aria-labelledby="collections-title">
      <p className="home-section__eyebrow">Каталог идей</p>
      <h2 id="collections-title" className="home-section__title">Подборки подарков</h2>
      <div className="home-collections__groups">
        {HOME_GIFT_LINK_GROUPS.map((group) => {
          const links = seasonal ? [
            ...seasonalPaths.flatMap((path) => group.links.filter((link) => link.href === path)),
            ...group.links.filter((link) => !seasonalPaths.includes(link.href)),
          ] : group.links;
          const more = links.slice(featuredLimit);
          return (
            <div className="home-collections__group" key={group.title}>
              <h3>{group.title}</h3>
              <GiftLinks links={links.slice(0, featuredLimit)} />
              {more.length > 0 && (
                <details className="home-collections__more">
                  <summary>Показать все</summary>
                  <GiftLinks links={more} />
                </details>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
