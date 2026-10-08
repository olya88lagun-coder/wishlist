"use client";

import Image from "next/image";
import type { ChildPartnerOffer } from "@/content/children-partner-offers";
import { trackEvent } from "@/lib/analytics";

export function ChildPartnerCard({ offer, source }: { offer: ChildPartnerOffer; source: string }) {
  const titleId = `child-product-${offer.sku}`;
  return (
    <article className="partner-gift child-partner" aria-labelledby={titleId}>
      <div className="partner-gift__media">
        <Image src={offer.image} alt={`Изображение предложения «${offer.title}»`} width={offer.width} height={offer.height} sizes="280px" />
      </div>
      <div className="partner-gift__content">
        <p className="partner-gift__age">В каталоге: {offer.catalogAgeLabel}</p>
        <h3 id={titleId}>{offer.title}</h3>
        <p>{offer.description}</p>
        <div className={`child-partner__age-info${offer.status !== "verified" ? " child-partner__age-info--check" : ""}`}>
          {offer.manufacturerAgeLabel && <p>{offer.manufacturerAgeLabel}</p>}
          {offer.ageSource && <a href={offer.ageSource} target="_blank" rel="noopener noreferrer">{offer.ageSourceLabel} <span aria-hidden="true">↗</span></a>}
          <p>{offer.ageNote}</p>
        </div>
        <p className="partner-gift__note">Цена и наличие — на странице товара в Ozon.</p>
        <a className="button partner-gift__button" href={offer.href} target="_blank" rel="sponsored nofollow noopener noreferrer"
          onClick={() => trackEvent("partner_product_click", { partner: "takprodam", store: "ozon", sku: offer.sku, source: `gifts/${source}` })}>
          Посмотреть на Ozon <span aria-hidden="true">↗</span>
        </a>
        <p className="partner-gift__disclosure">{offer.disclosure}</p>
      </div>
    </article>
  );
}
