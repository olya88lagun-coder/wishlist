import type { Metadata } from "next";
import Link from "next/link";
import { COLLECTED_DATA, OPERATOR, PRIVACY_UPDATED_AT } from "./operator";

export const metadata: Metadata = { title: "Политика конфиденциальности — вишлист", robots: { index: false, follow: false } };

export default function PrivacyPage() {
  return (
    <main className="page stack legal">
      <Link className="eyebrow" href="/">
        ← На главную
      </Link>
      <h1 className="display" style={{ marginBottom: 0 }}>
        Политика <i>конфиденциальности</i>
      </h1>
      <p className="muted">Редакция от {PRIVACY_UPDATED_AT}</p>

      <h2>Кто обрабатывает данные</h2>
      <p>
        Оператор — {OPERATOR.name}, плательщик налога на профессиональный доход, ИНН {OPERATOR.inn}. Вопросы и отзыв согласия:{" "}
        <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>.
      </p>

      <h2>Какие данные и зачем</h2>
      <ul>
        {COLLECTED_DATA.map((row) => (
          <li key={row.what}>
            <b>{row.what}</b> — {row.why}. Где хранится: {row.where}.
          </li>
        ))}
      </ul>

      <h2>Кому передаём</h2>
      <p>Данные не продаются и не передаются третьим лицам для рекламы. Хостинг и хранилище файлов расположены в России.</p>

      <h2>Сроки и удаление</h2>
      <p>
        Данные хранятся, пока существует аккаунт или бронь. Удалить аккаунт, списки или бронь можно, написав на {OPERATOR.email}; запрос
        выполняется в течение 30 дней. Резервные копии базы удаляются автоматически через 14 дней.
      </p>

      <h2>Согласие</h2>
      <p>
        Входя через Telegram или VK ID, а также бронируя подарок, вы соглашаетесь на обработку перечисленных данных для работы сервиса.
        Согласие можно отозвать письмом на {OPERATOR.email}.
      </p>
    </main>
  );
}
