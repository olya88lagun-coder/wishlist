import { listWishlistsForOwner } from "@wishlist/db";
import Link from "next/link";
import { CountdownSticker } from "@/components/CountdownSticker";
import { getDb } from "@/server/db";
import { SiteFooter } from "@/components/SiteFooter";
import { OwnerPageHeader } from "@/components/OwnerPageHeader";
import { requireUser } from "@/server/viewer";
import { CreateListForm } from "./CreateListForm";

export const dynamic = "force-dynamic";

export default async function ListsPage() {
  const user = await requireUser();
  const lists = await listWishlistsForOwner(getDb(), user.id);
  return (
    <main className="page owner-page">
      <OwnerPageHeader
        eyebrow={`Привет, ${user.displayName.split(" ")[0]}`}
        title={<>Мои <i>списки</i></>}
        description="Все желания, важные даты и идеи для подарков — в одном красивом месте."
        actions={<span className="owner-hero__stat">{lists.length} {lists.length === 1 ? "список" : lists.length < 5 ? "списка" : "списков"}</span>}
      />
      {lists.length > 0 && (
        <nav className="owner-list-grid" aria-label="Мои списки">
          {lists.map((list) => (
            <Link key={list.id} href={`/lists/${list.id}`} className="owner-list-card">
              <div className="owner-list-card__topline">
                <span>Список желаний</span>
                <CountdownSticker occasion={list.occasion} eventDate={list.eventDate} />
              </div>
              <div className="owner-list-card__body">
                <h2>{list.title}</h2>
                <p>
                  {list.itemCount === 0 ? "Пока без подарков" : `Подарков: ${list.itemCount}`}
                </p>
              </div>
              <span className="owner-list-card__open">Открыть список <span aria-hidden="true">→</span></span>
            </Link>
          ))}
        </nav>
      )}
      <CreateListForm defaultOpen={lists.length === 0} />
      <div className="owner-footer"><SiteFooter /></div>
    </main>
  );
}
