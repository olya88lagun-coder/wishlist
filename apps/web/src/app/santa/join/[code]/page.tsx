import { getSantaJoinInfo, listSantaGamesForUser } from "@wishlist/db";
import { notFound } from "next/navigation";
import { getDb } from "@/server/db";
import { readViewer } from "@/server/viewer";
import { SantaCover, SantaFacts, SantaFrame } from "../../SantaPresentation";
import { JoinSantaForm } from "./JoinSantaForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Тайный Санта — вступить в игру" };

type Props = { params: Promise<{ code: string }> };

export default async function JoinSantaPage({ params }: Props) {
  const { code } = await params;
  const info = await getSantaJoinInfo(getDb(), code);
  if (!info) notFound();
  const { user } = await readViewer();
  // Без редиректа: после вступления страница перерисовывается, и форма должна успеть показать личную ссылку
  const joined = Boolean(user && (await listSantaGamesForUser(getDb(), user.id)).some((game) => game.id === info.gameId));
  return (
    <SantaFrame>
      <div className="santa-split">
        <SantaCover eyebrow="Тайный Санта · приглашение" title={info.title} artwork="envelope">
          <SantaFacts exchangeDate={info.exchangeDate} budget={info.budgetText} count={info.participantCount} />
        </SantaCover>
        <section className="santa-paper santa-paper--form" aria-label="Вступление в игру">
          {info.status === "drawn" && !joined ? (
            <>
              <p className="santa-kicker">Набор закрыт</p>
              <h2>Жеребьёвка уже прошла</h2>
              <p className="santa-note">Участники получили имена получателей. Вступить в эту игру уже нельзя.</p>
            </>
          ) : (
            <JoinSantaForm code={code} gameId={info.gameId} joined={joined} defaultName={user?.displayName.split(" ")[0] ?? ""} />
          )}
        </section>
      </div>
    </SantaFrame>
  );
}
