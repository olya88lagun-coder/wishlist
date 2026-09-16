import { getPublicWishlist, type PublicItemView } from "@wishlist/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CountdownSticker } from "@/components/CountdownSticker";
import { EmptyState } from "@/components/EmptyState";
import { ItemCard } from "@/components/ItemCard";
import { imageUrlFor } from "@/components/item-image";
import { toCardModel } from "@/components/item-card-model";
import { ReservedSticker } from "@/components/ReservedSticker";
import { ShareBar } from "@/components/ShareBar";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { readViewer } from "@/server/viewer";
import { CancelReservationButton } from "./CancelReservationButton";
import { ReserveSheet } from "./ReserveSheet";
import { reminderBotLink } from "./remind-link";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { viewer } = await readViewer();
  const view = await getPublicWishlist(getDb(), slug, viewer);
  if (!view) return { title: "Вишлист", robots: { index: false, follow: false } };
  const title = `${view.wishlist.title} — вишлист`;
  const description = `${view.ownerName} собирает подарки. Выбирайте и бронируйте — владелец не узнает, кто что дарит.`;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "website", locale: "ru_RU", siteName: "Вишлист", url: `/${view.wishlist.slug}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

function stickerFor(item: PublicItemView) {
  if (item.status === "reserved_by_me") return <ReservedSticker label="вы дарите" />;
  if (item.status === "reserved_by_other") return <ReservedSticker />;
  return undefined;
}

export default async function PublicWishlistPage({ params }: Props) {
  const { slug } = await params;
  const { viewer, user } = await readViewer();
  const view = await getPublicWishlist(getDb(), slug, viewer);
  if (!view) notFound();
  const { wishlist, items, ownerName, isOwner } = view;
  const shareUrl = new URL(`/${wishlist.slug}`, getEnv().APP_URL).toString();
  const publicBaseUrl = getEnv().S3_PUBLIC_BASE_URL;
  const defaultName = user?.displayName.split(" ")[0] ?? "";
  const env = getEnv();

  return (
    <main className="page page--wide">
      <div className="row row--between">
        <p className="eyebrow">список {ownerName}</p>
        <CountdownSticker occasion={wishlist.occasion} eventDate={wishlist.eventDate} />
      </div>
      <h1 className="display">{wishlist.title}</h1>

      {isOwner && (
        <p className="panel muted" style={{ marginBottom: 20 }}>
          Это ваш список — так его видят гости. <Link href={`/lists/${wishlist.id}`}>Редактировать</Link>
        </p>
      )}

      {items.length === 0 ? (
        <EmptyState title="Пока пусто" text={`${ownerName} ещё не добавил(а) подарки. Загляните позже.`} />
      ) : (
        <section className="grid" aria-label="Подарки">
          {items.map((item) => (
            <ItemCard key={item.id} item={{ ...item, imageUrl: imageUrlFor(item.imageKey, publicBaseUrl) }} dimmed={item.status === "reserved_by_other"} sticker={stickerFor(item)}>
              {!isOwner && item.status === "free" && (
                <ReserveSheet
                  slug={wishlist.slug}
                  itemId={item.id}
                  itemTitle={item.title}
                  priceText={toCardModel(item).priceText}
                  ownerName={ownerName}
                  defaultName={defaultName}
                />
              )}
              {!isOwner && item.status === "reserved_by_me" && (
                <div className="row" style={{ flexWrap: "wrap" }}>
                  <CancelReservationButton slug={wishlist.slug} itemId={item.id} />
                  {item.remindReservationId && (
                    <a
                      className="link-button"
                      href={reminderBotLink(env.TELEGRAM_BOT_USERNAME, item.remindReservationId, env.SESSION_SECRET)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Напомнить в Telegram
                    </a>
                  )}
                </div>
              )}
            </ItemCard>
          ))}
        </section>
      )}

      <div style={{ marginTop: 32 }}>
        <ShareBar url={shareUrl} title={`${wishlist.title} — вишлист ${ownerName}`} />
      </div>
    </main>
  );
}
