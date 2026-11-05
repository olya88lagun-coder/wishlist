import { redirect } from "next/navigation";
import { requireUser } from "@/server/viewer";
import { SantaCover, SantaFrame } from "../SantaPresentation";
import { CreateSantaForm } from "./CreateSantaForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Новая игра — Тайный Санта" };

export default async function NewSantaGamePage() {
  const user = await requireUser();
  // Организатор управляет игрой, его нельзя потерять: нужен вход через Telegram или VK
  if (user.providers.length === 0) redirect("/login?returnTo=/santa/new");
  return (
    <SantaFrame>
      <div className="santa-split">
        <SantaCover eyebrow="Обмен подарками" title={<>Тайный <em>Санта</em></>} artwork="gifts">
          <p className="santa-cover__lead">Одна ссылка для всей компании. У каждого свой вишлист и один получатель, о котором знает только его Санта.</p>
        </SantaCover>
        <section className="santa-paper santa-paper--form" aria-labelledby="santa-new-title">
          <p className="santa-kicker">Для организатора</p>
          <h2 id="santa-new-title">Создайте игру</h2>
          <p className="santa-note">Договоритесь о дате и бюджете. Ссылку для участников вы получите сразу после создания игры.</p>
          <CreateSantaForm defaultName={user.displayName.split(" ")[0] ?? ""} />
        </section>
      </div>
      <ol className="santa-steps" aria-label="Как проходит игра">
        <li><span aria-hidden="true">01</span><div><strong>Пригласите компанию</strong><p>Отправьте ссылку в общий чат. Друзья могут вступить без входа.</p></div></li>
        <li><span aria-hidden="true">02</span><div><strong>Добавьте желания</strong><p>У каждого будет свой список подарков.</p></div></li>
        <li><span aria-hidden="true">03</span><div><strong>Проведите жеребьёвку</strong><p>Каждый получит имя и вишлист того, кому дарит.</p></div></li>
      </ol>
    </SantaFrame>
  );
}
