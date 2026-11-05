import { redirect } from "next/navigation";
import { requireUser } from "@/server/viewer";
import { CreateSantaForm } from "./CreateSantaForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Новая игра — Тайный Санта" };

export default async function NewSantaGamePage() {
  const user = await requireUser("/santa/new");
  // Организатор управляет игрой, его нельзя потерять: нужен вход через Telegram или VK
  if (user.providers.length === 0) redirect("/login?returnTo=/santa/new");
  return (
    <main className="page">
      <h1>Тайный Санта</h1>
      <p>Создайте игру и отправьте ссылку в общий чат. Когда все вступят, проведите жеребьёвку.</p>
      <CreateSantaForm defaultName={user.displayName.split(" ")[0] ?? ""} />
    </main>
  );
}
