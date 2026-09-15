import { listWishlistsForOwner } from "@wishlist/db";
import Link from "next/link";
import { CountdownSticker } from "@/components/CountdownSticker";
import { getDb } from "@/server/db";
import { requireUser } from "@/server/viewer";
import { CreateListForm } from "./CreateListForm";

export const dynamic = "force-dynamic";

export default async function ListsPage() {
  const user = await requireUser();
  const lists = await listWishlistsForOwner(getDb(), user.id);
  return (
    <main className="page">
      <div className="row row--between">
        <p className="eyebrow">Привет, {user.displayName.split(" ")[0]}</p>
        <Link className="muted" href="/me">Профиль</Link>
      </div>
      <h1 className="display">
        Мои <i>списки</i>
      </h1>
      {lists.length > 0 && (
        <nav aria-label="Мои списки" style={{ marginBottom: 24 }}>
          {lists.map((list) => (
            <Link key={list.id} href={`/lists/${list.id}`} className="list-row">
              <div>
                <p className="list-row__title">{list.title}</p>
                <p className="muted" style={{ margin: 0 }}>
                  {list.itemCount === 0 ? "Пока без подарков" : `Подарков: ${list.itemCount}`}
                </p>
              </div>
              <CountdownSticker occasion={list.occasion} eventDate={list.eventDate} />
            </Link>
          ))}
        </nav>
      )}
      <CreateListForm defaultOpen={lists.length === 0} />
    </main>
  );
}
