import { formatKopecks } from "@wishlist/core";
import { getOwnerWishlistView, type OwnerItemView } from "@wishlist/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CountdownSticker } from "@/components/CountdownSticker";
import { EmptyState } from "@/components/EmptyState";
import { ItemCard } from "@/components/ItemCard";
import { imageUrlFor } from "@/components/item-image";
import { ReservedSticker } from "@/components/ReservedSticker";
import { ShareBar } from "@/components/ShareBar";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { requireUser } from "@/server/viewer";
import { deleteItemAction } from "./actions";
import { AddItemForm } from "./AddItemForm";
import { ConfirmButton } from "./ConfirmButton";
import { ItemEditor } from "./ItemEditor";
import { ListSettings } from "./ListSettings";
import { parseHint } from "./parse-hint";
import { PendingRefresher } from "./PendingRefresher";
import { QuickLinkForm } from "./QuickLinkForm";

export const dynamic = "force-dynamic";

function editorDefaults(item: OwnerItemView) {
  return {
    title: item.title,
    url: item.sourceUrl ?? "",
    price: item.priceKopecks === null ? "" : formatKopecks(item.priceKopecks).replace(/ ₽$/, ""),
    note: item.note ?? "",
    isMustHave: item.isMustHave,
  };
}

export default async function OwnerListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const view = await getOwnerWishlistView(getDb(), user.id, id);
  if (!view) notFound();
  const { wishlist, items, surpriseMode } = view;
  const shareUrl = new URL(`/${wishlist.slug}`, getEnv().APP_URL).toString();
  const publicBaseUrl = getEnv().S3_PUBLIC_BASE_URL;
  const pendingCount = items.filter((item) => item.parseStatus === "pending").length;

  return (
    <main className="page page--wide">
      <div className="row row--between">
        <Link className="eyebrow" href="/lists">← Мои списки</Link>
        <CountdownSticker occasion={wishlist.occasion} eventDate={wishlist.eventDate} />
      </div>
      <h1 className="display">{wishlist.title}</h1>
      <div className="row" style={{ marginBottom: 20, flexWrap: "wrap" }}>
        <Link className="button button--ghost button--small" href={`/${wishlist.slug}`}>Как видят гости</Link>
        {surpriseMode && <span className="muted">Режим «Полный сюрприз»: брони скрыты</span>}
      </div>

      <div style={{ marginBottom: 20 }}>
        <ShareBar url={shareUrl} title={`${wishlist.title} — вишлист`} />
      </div>

      <QuickLinkForm wishlistId={wishlist.id} />
      <AddItemForm wishlistId={wishlist.id} defaultOpen={false} />
      <PendingRefresher pendingCount={pendingCount} />

      {items.length === 0 ? (
        <EmptyState title="Здесь будут подарки" text="Вставьте ссылку из любого магазина — название, фото и цену подтянем сами." />
      ) : (
        <section className="grid" aria-label="Подарки">
          {items.map((item) => {
            const hint = parseHint(item);
            return (
              <ItemCard
                key={item.id}
                item={{ ...item, imageUrl: imageUrlFor(item.imageKey, publicBaseUrl) }}
                dimmed={item.reserved}
                sticker={item.reserved ? <ReservedSticker label="забронировано" /> : undefined}
              >
                {hint && <p className="card__hint">{hint}</p>}
                <ItemEditor wishlistId={wishlist.id} itemId={item.id} defaults={editorDefaults(item)} />
                <ConfirmButton action={deleteItemAction.bind(null, wishlist.id, item.id)} question={`Удалить «${item.title || "подарок"}»?`}>
                  Удалить
                </ConfirmButton>
              </ItemCard>
            );
          })}
        </section>
      )}

      <ListSettings wishlist={wishlist} />
    </main>
  );
}
