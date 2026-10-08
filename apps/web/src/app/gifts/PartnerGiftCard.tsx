"use client";

import Image from "next/image";
import { ZABIAKA_PARTNER_OFFER as offer } from "@/content/partner-offers";
import { trackEvent } from "@/lib/analytics";

export function PartnerGiftCard() {
  return (
    <section className="partner-gift" aria-labelledby="partner-gift-title">
      <div className="partner-gift__media">
        <Image
          src={offer.image}
          alt="Набор ZABIAKA: фигурки животных, овощи и фрукты для сортировки"
          width={1600}
          height={1600}
          sizes="(max-width: 600px) 280px, 280px"
        />
      </div>
      <div className="partner-gift__content">
        <p className="partner-gift__age">Для детей от 3 лет</p>
        <h2 id="partner-gift-title">{offer.title}</h2>
        <p>Игра для знакомства с цветами, счётом и сортировкой. Ребёнок раскладывает овощи и фрукты и «кормит» животных.</p>
        <p className="partner-gift__note">Цена и наличие — на странице товара в Ozon.</p>
        <a
          className="button partner-gift__button"
          href={offer.href}
          target="_blank"
          rel="sponsored nofollow noopener noreferrer"
          onClick={() => trackEvent("partner_product_click", { partner: "takprodam", store: "ozon", sku: offer.sku, source: "gifts/under-3000" })}
        >
          Посмотреть на Ozon <span aria-hidden="true">↗</span>
        </a>
        <p className="partner-gift__disclosure">
          Реклама. {offer.advertiser}. ИНН {offer.inn}. erid {offer.erid}
        </p>
      </div>
    </section>
  );
}
