import { BRAND_ADVERTISER, brandOffersForPage, eridFromTemplate } from "@/content/brand-offers";
import { BRAND_TEMPLATE_ENV, enabledBrands } from "@/server/brand-offers";

// Карточки магазинов бренда на странице подборки. Показываются только для брендов с заданным партнёрским шаблоном.
export function BrandOfferCards({ slug }: { slug: string }) {
  const offers = brandOffersForPage(slug, enabledBrands());
  if (offers.length === 0) return null;

  return (
    <section className="brand-offers" aria-labelledby="brand-offers-title">
      <h2 id="brand-offers-title">Из каталогов брендов</h2>
      <ul className="brand-offers__list">
        {offers.map((offer) => {
          const advertiser = BRAND_ADVERTISER[offer.brand];
          const erid = eridFromTemplate(process.env[BRAND_TEMPLATE_ENV[offer.brand]]);
          const href = `/go/brand?${new URLSearchParams({ offer: offer.id, from: `gifts/${slug}` }).toString()}`;
          return (
            <li className="brand-offer" key={offer.id}>
              <h3>{offer.title}</h3>
              <p>{slug === "for-mom" && offer.id === "tefal-posuda" ? "Если мама сама просила посуду. " : ""}{offer.text}</p>
              <p className="brand-offer__note">Цена и наличие — на сайте магазина.</p>
              <a className="button" href={href} target="_blank" rel="sponsored nofollow noopener noreferrer">
                Посмотреть на {advertiser.site} <span aria-hidden="true">↗</span>
              </a>
              <p className="brand-offer__disclosure">
                Реклама. {advertiser.name}. ИНН {advertiser.inn}.{erid ? ` erid ${erid}` : ""}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
