import { getSantaGameView } from "@wishlist/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { readViewer } from "@/server/viewer";
import { DrawButton, ParticipantControls, RecipientLink } from "./GameControls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Тайный Санта" };

type Props = { params: Promise<{ id: string }> };

export default async function SantaGamePage({ params }: Props) {
  const { id } = await params;
  const { user } = await readViewer();
  if (!user) {
    return (
      <main className="page">
        <h1>Тайный Санта</h1>
        <p>Откройте свою личную ссылку или <Link href={`/login?returnTo=/santa/${id}`}>войдите</Link>, чтобы увидеть игру.</p>
      </main>
    );
  }
  const view = await getSantaGameView(getDb(), id, user.id);
  if (!view) notFound();
  const { game, isOrganizer, me, participants, recipient } = view;
  const open = game.status === "open";
  const joinLink = game.joinCode ? new URL(`/santa/join/${game.joinCode}`, getEnv().APP_URL).toString() : null;

  return (
    <main className="page">
      <h1>Тайный Санта: {game.title}</h1>
      <p>Обмен подарками: {game.exchangeDate}{game.budgetText && `, бюджет ${game.budgetText}`}.</p>

      {recipient ? (
        <section aria-label="Ваш получатель">
          <p>Вы дарите: <strong>{recipient.displayName}</strong></p>
          {recipient.wishlistSlug
            ? <RecipientLink href={`/${recipient.wishlistSlug}`} />
            : <p>Список желаний получателя удалён.</p>}
        </section>
      ) : (
        <p>Жеребьёвка ещё не прошла. Добавьте желания, пока все вступают.</p>
      )}

      <section aria-label="Мой список">
        {me.wishlistId
          ? <Link href={`/lists/${me.wishlistId}`}>Мой список желаний</Link>
          : <p>У вас нет списка для этой игры.</p>}
      </section>

      {user.providers.length === 0 && (
        <section aria-label="Вход">
          <p>Вы в игре без входа. Сохраните личную ссылку или войдите через Telegram — бот пришлёт результат жеребьёвки и напомнит о дате.</p>
          <Link href={`/login?returnTo=/santa/${game.id}`}>Войти</Link>
        </section>
      )}

      {isOrganizer && joinLink && open && (
        <section aria-label="Приглашение">
          <div className="field">
            <label htmlFor="santa-join-link">Ссылка для участников</label>
            <input id="santa-join-link" className="input" readOnly value={joinLink} />
          </div>
        </section>
      )}

      <section aria-label="Участники">
        <h2>Участники: {participants.length}</h2>
        <ul>
          {participants.map((p) => (
            <li key={p.id}>
              {p.displayName} — желаний: {p.itemCount}{p.signedIn ? ", вошёл" : ""}
              {isOrganizer && open && p.id !== me.participantId && (
                <ParticipantControls gameId={game.id} participantId={p.id} canRecover={!p.signedIn} />
              )}
            </li>
          ))}
        </ul>
      </section>

      {isOrganizer && open && <DrawButton gameId={game.id} />}
    </main>
  );
}
