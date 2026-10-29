import { formatKopecks } from "@wishlist/core";
import { getDesignAccess, getOwnerWishlistView, type OwnerItemView } from "@wishlist/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CountdownSticker } from "@/components/CountdownSticker";
import { EmptyState } from "@/components/EmptyState";
import { ItemCard } from "@/components/ItemCard";
import { imageUrlFor } from "@/components/item-image";
import { ReservedSticker } from "@/components/ReservedSticker";
import { ShareBar } from "@/components/ShareBar";
import { SiteFooter } from "@/components/SiteFooter";
import { OwnerPageHeader } from "@/components/OwnerPageHeader";
import { WishlistTheme } from "@/components/WishlistTheme";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { freeDesignTelegramIds } from "@/server/free-designs";
import { requireUser } from "@/server/viewer";
import { deleteItemAction } from "./actions";
import { AddItemForm } from "./AddItemForm";
import { ConfirmButton } from "./ConfirmButton";
import { DesignPromo } from "./DesignPromo";
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
  const design = await getDesignAccess(getDb(), id, freeDesignTelegramIds());
  const shareUrl = new URL(`/${wishlist.slug}`, getEnv().APP_URL).toString();
  const publicBaseUrl = getEnv().S3_PUBLIC_BASE_URL;
  const pendingCount = items.filter((item) => item.parseStatus === "pending").length;
  const giftCountText = items.length === 0
    ? "Пока без подарков — добавьте первое желание."
    : `${items.length} ${items.length === 1 ? "подарок" : items.length < 5 ? "подарка" : "подарков"} в вашем списке.`;

  return (
    <WishlistTheme theme={design.theme}>
    <main className={`page owner-page owner-page--detail${design.theme === "journal" ? "" : " wishlist-page"}`}>
      <OwnerPageHeader
        eyebrow="Ваш список желаний"
        title={wishlist.title}
        description={giftCountText}
        actions={(
          <>
            <Link className="owner-back-link" href="/lists">← Все списки</Link>
            <CountdownSticker occasion={wishlist.occasion} eventDate={wishlist.eventDate} />
            <Link className="button button--ghost button--small" href={`/${wishlist.slug}`}>Как видят гости</Link>
          </>
        )}
      />

      <DesignPromo wishlistId={wishlist.id} access={design} />

      {surpriseMode && <p className="owner-surprise-note">Режим «Полный сюрприз»: брони скрыты от владельца</p>}

      <section className="owner-command-center" aria-label="Добавить подарок и поделиться списком">
        <div className="owner-command-center__primary">
          <p className="owner-section-kicker">Новое желание</p>
          <QuickLinkForm wishlistId={wishlist.id} />
          <AddItemForm wishlistId={wishlist.id} defaultOpen={false} />
          <PendingRefresher pendingCount={pendingCount} />
        </div>
        <div className="owner-share">
          <p className="owner-section-kicker">Поделиться</p>
          <ShareBar url={shareUrl} title={`${wishlist.title} — вишлист`} />
        </div>
      </section>

      {items.length === 0 ? (
        <div className="owner-empty">
          <EmptyState title="Здесь будут подарки" text="Вставьте ссылку из любого магазина — название, фото и цену подтянем сами." />
        </div>
      ) : (
        <section className="owner-gifts" aria-labelledby="owner-gifts-title">
          <div className="owner-section-heading">
            <div>
              <p className="owner-section-kicker">Коллекция желаний</p>
              <h2 id="owner-gifts-title">Подарки в списке</h2>
            </div>
            <span>{items.length}</span>
          </div>
          <div className="grid owner-gift-grid">
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
          </div>
        </section>
      )}

      <section className="owner-settings" aria-label="Настройки оформления и списка">
        <ListSettings wishlist={wishlist} />
      </section>
      <div className="owner-footer"><SiteFooter /></div>
    </main>
    </WishlistTheme>
  );
}
