"use client";

import { startLinks } from "@/components/start-links";
import { trackEvent } from "@/lib/analytics";

type Props = { botUsername: string; signedIn: boolean; reservedSomething: boolean };

export function GuestCta({ botUsername, signedIn, reservedSomething }: Props) {
  return (
    <section className="panel stack guest-cta" aria-label="Свой вишлист">
      <h2 className="serif" style={{ margin: 0, fontSize: 24, fontWeight: 500 }}>
        {reservedSomething ? "Подарок выбран. А что хотите вы?" : "Соберите свой вишлист"}
      </h2>
      <p className="muted" style={{ margin: 0 }}>
        Вставьте ссылки из любых магазинов — фото и цены подтянутся сами. Друзья бронируют подарки, а вы не знаете, кто что дарит.
      </p>
      <div className="row" style={{ flexWrap: "wrap" }}>
        {startLinks(botUsername, signedIn).map((link, index) => (
          <a
            key={link.id}
            className={index === 0 ? "button button--small" : "button button--ghost button--small"}
            href={link.href}
            onClick={() => trackEvent("guest_wishlist_cta_click", {
              destination: link.id,
              placement: reservedSomething ? "after_reservation" : "wishlist_footer",
              signed_in: signedIn,
            })}
            {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {reservedSomething && link.id === "site" ? "Создать свой список" : link.label}
          </a>
        ))}
      </div>
    </section>
  );
}
