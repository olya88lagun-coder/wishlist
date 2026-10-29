import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { OPERATOR } from "../privacy/operator";
import { OFFER_PRODUCTS, OFFER_UPDATED_AT } from "./offer";

export const metadata: Metadata = { title: "Условия покупки — вишлист", robots: { index: false, follow: false } };

export default function OfertaPage() {
  return (
    <main className="page stack legal">
      <Link className="eyebrow" href="/">
        ← На главную
      </Link>
      <h1 className="display" style={{ marginBottom: 0 }}>
        Условия <i>покупки</i>
      </h1>
      <p className="muted">Редакция от {OFFER_UPDATED_AT}</p>

      <h2>Кто продаёт</h2>
      <p>
        {OPERATOR.name}, плательщик налога на профессиональный доход, ИНН {OPERATOR.inn}. Связаться по вопросам оплаты и возврата:{" "}
        <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>.
      </p>

      <h2>Что вы покупаете</h2>
      <p>
        Платное оформление страницы вишлиста на сайте my-wish-list.online. Это цифровая услуга: после подтверждения оплаты оформление
        включается для выбранного списка. Обычная ссылка, бронирование подарков и «Журнал» остаются бесплатными.
      </p>
      <ul>
        {OFFER_PRODUCTS.map((product) => (
          <li key={product.name}>
            <b>
              {product.name} — {product.price}
            </b>
            : {product.what}.
          </li>
        ))}
      </ul>

      <h2>Как это работает</h2>
      <ul>
        <li>Оплата разовая, без подписки. Срок действия не ограничен.</li>
        <li>Покупка привязана к тому списку, в котором вы её оформили. Если удалить список, оформление для него пропадает.</li>
        <li>
          Приглашение создаётся по вашему запросу. Дату, адрес и текст приглашения сайт не сохраняет. MAX, Telegram и ВК получают обычную
          картинку; кнопки со ссылкой внутри неё нет.
        </li>
      </ul>

      <h2>Оплата и чек</h2>
      <p>
        Оплата проходит на странице ЮKassa. Данные банковской карты сайту не передаются. Чек самозанятого из «Мой налог» оформляется
        после оплаты; для связи по заказу укажите email.
      </p>

      <h2>Возврат</h2>
      <p>
        Если оформление не включилось или деньги списаны по ошибке, напишите на {OPERATOR.email} с email, указанным при оплате. Решение
        по возврату принимает продавец; возврат делается тем же способом, которым вы платили.
      </p>

      <h2>Персональные данные</h2>
      <p>
        Какие данные мы получаем при покупке и как их храним, описано в <Link href="/privacy">политике конфиденциальности</Link>.
      </p>
      <SiteFooter />
    </main>
  );
}
