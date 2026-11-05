import { getSantaJoinInfo, listSantaGamesForUser } from "@wishlist/db";
import { notFound } from "next/navigation";
import { getDb } from "@/server/db";
import { readViewer } from "@/server/viewer";
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
    <main className="page">
      <h1>Тайный Санта: {info.title}</h1>
      <p>Обмен подарками: {info.exchangeDate}{info.budgetText && `, бюджет ${info.budgetText}`}. Уже в игре: {info.participantCount}.</p>
      {info.status === "drawn" && !joined
        ? <p>Жеребьёвка уже прошла, вступить нельзя.</p>
        : <JoinSantaForm code={code} gameId={info.gameId} joined={joined} defaultName={user?.displayName.split(" ")[0] ?? ""} />}
    </main>
  );
}
