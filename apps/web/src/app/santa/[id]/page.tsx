import { getSantaGameView } from "@wishlist/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { readViewer } from "@/server/viewer";
import { CopyLinkField } from "../CopyLinkField";
import { SantaCover, SantaFacts, SantaFrame } from "../SantaPresentation";
import { DrawButton, ParticipantControls, RecipientLink } from "./GameControls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Тайный Санта" };

type Props = { params: Promise<{ id: string }> };

export default async function SantaGamePage({ params }: Props) {
  const { id } = await params;
  const { user } = await readViewer();
  if (!user) {
    return (
      <SantaFrame>
        <SantaCover eyebrow="Новогодний обмен подарками" title="Тайный Санта" artwork="envelope">
          <p className="santa-cover__lead">Откройте свою личную ссылку или <Link href={`/login?returnTo=/santa/${id}`}>войдите</Link>, чтобы увидеть игру.</p>
        </SantaCover>
      </SantaFrame>
    );
  }
  const view = await getSantaGameView(getDb(), id, user.id);
  if (!view) notFound();
  const { game, isOrganizer, me, participants, recipient } = view;
  const open = game.status === "open";
  const joinLink = game.joinCode ? new URL(`/santa/join/${game.joinCode}`, getEnv().APP_URL).toString() : null;

  return (
    <SantaFrame>
      <SantaCover eyebrow="Тайный Санта" title={game.title} artwork="envelope">
        <SantaFacts exchangeDate={game.exchangeDate} budget={game.budgetText} count={participants.length} />
      </SantaCover>

      <div className="santa-game-grid">
        {recipient ? (
          <section className="santa-paper santa-recipient" aria-label="Ваш получатель">
            <p className="santa-kicker">Результат жеребьёвки · Только для вас</p>
            <p className="santa-recipient__label">Вы дарите:</p>
            <h2>{recipient.displayName}</h2>
            {recipient.wishlistSlug
              ? <RecipientLink href={`/${recipient.wishlistSlug}`} />
              : <p className="santa-note">Список желаний получателя удалён.</p>}
          </section>
        ) : (
          <section className="santa-paper" aria-labelledby="santa-waiting">
            <p className="santa-kicker">{open ? "До жеребьёвки" : "После жеребьёвки"}</p>
            <h2 id="santa-waiting">{open ? "Секрет ещё под печатью" : "Получатель недоступен"}</h2>
            <p className="santa-note">{open ? "Жеребьёвка ещё не прошла. Добавьте желания, пока все вступают." : "Данные о вашем получателе больше недоступны."}</p>
          </section>
        )}

        <section className="santa-paper" aria-label="Мой список">
          <p className="santa-kicker">Ваш вишлист</p>
          <h2>Что вы хотите получить?</h2>
          {me.wishlistId ? (
            <>
              <p className="santa-note">Добавьте подарки, чтобы вашему Санте было проще выбрать.</p>
              <Link className="button button--ghost" href={`/lists/${me.wishlistId}`}>Мой список желаний</Link>
            </>
          ) : <p className="santa-note">У вас нет списка для этой игры.</p>}
        </section>
      </div>

      {(user.providers.length === 0 || (isOrganizer && open)) && (
        <section className="santa-paper santa-management" aria-label={isOrganizer ? "Управление игрой" : "Вход"}>
          <div>
            <p className="santa-kicker">{isOrganizer ? "Для организатора" : "Для участника"}</p>
            <h2>{isOrganizer ? "Соберите компанию" : "Сохраните доступ к игре"}</h2>
            <p className="santa-note">{isOrganizer
              ? "Отправьте приглашение в общий чат. Для жеребьёвки нужно минимум три участника."
              : "Сохраните личную ссылку, которую получили при вступлении, или войдите через Telegram. Бот пришлёт результат жеребьёвки и напомнит о дате обмена."}</p>
          </div>
          {user.providers.length === 0 && <Link className="button button--ghost" href={`/login?returnTo=/santa/${game.id}`}>Войти</Link>}
          {isOrganizer && joinLink && open && <CopyLinkField label="Ссылка для участников" value={joinLink} />}
        </section>
      )}

      <section className="santa-paper santa-participants" aria-labelledby="santa-participants-title">
        <h2 id="santa-participants-title">Участники <span>{participants.length}</span></h2>
        <ul className="santa-people">
          {participants.map((p) => (
            <li key={p.id} className="santa-person">
              <div className="santa-person__copy">
                <strong>{p.displayName}</strong>
                <span className="santa-note">Желаний: {p.itemCount}{p.signedIn ? " · Вошёл в аккаунт" : ""}</span>
              </div>
              {isOrganizer && open && p.id !== me.participantId && (
                <ParticipantControls gameId={game.id} participantId={p.id} canRecover={!p.signedIn} />
              )}
            </li>
          ))}
        </ul>
        {isOrganizer && open && <DrawButton gameId={game.id} />}
      </section>
    </SantaFrame>
  );
}
