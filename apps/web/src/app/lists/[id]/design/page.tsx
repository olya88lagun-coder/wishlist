import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDesignAccess, getOwnerWishlistView, getPendingDesignOrders } from "@wishlist/db";
import { ItemCard } from "@/components/ItemCard";
import { imageUrlFor } from "@/components/item-image";
import { InvitationEditor } from "@/components/InvitationEditor";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { readPaymentConfig } from "@/server/design-payments";
import { requireUser } from "@/server/viewer";
import { DesignStudio } from "./DesignStudio";
import { checkDesignPaymentAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Оформление вишлиста", robots: { index: false, follow: false } };

export default async function DesignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ payment?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const view = await getOwnerWishlistView(getDb(), user.id, id);
  if (!view) notFound();
  const access = await getDesignAccess(getDb(), id);
  const pending = await getPendingDesignOrders(getDb(), user.id, id);
  const config = readPaymentConfig();
  const returned = (await searchParams).payment === "return";
  const shareUrl = new URL(`/${view.wishlist.slug}`, getEnv().APP_URL).toString();
  return <main className="page page--wide design-page">
    <Link href={`/lists/${id}`}>Вернуться к списку</Link>
    <h1>Оформление списка</h1>
    {(pending.length > 0 || returned) && <div className="design-status" role="status">
      <p>{pending.length ? "Ожидаем подтверждение оплаты" : access.children || access.newYear ? "Покупка подтверждена" : "Платные функции ещё не активированы"}</p>
      <form action={checkDesignPaymentAction.bind(null, id)}><button className="button button--ghost button--small">Проверить оплату</button></form>
    </div>}
    <DesignStudio wishlistId={id} title={view.wishlist.title} access={access} salesEnabled={Boolean(config)} testMode={config?.YOOKASSA_TEST_MODE === "true"} offerUrl={config?.YOOKASSA_OFFER_URL ?? null} checkOnReturn={returned && pending.length > 0}
      defaultTheme={view.wishlist.occasion === "new_year" ? "new-year" : "children"}
      invitationEditor={<InvitationEditor wishlistId={id} title={view.wishlist.title} eventDate={view.wishlist.eventDate} shareUrl={shareUrl} enabled={access.invitation} />}
      preview={<div className="grid">{view.items.slice(0, 2).map(item => <ItemCard key={item.id} item={{ ...item, imageUrl: imageUrlFor(item.imageKey, getEnv().S3_PUBLIC_BASE_URL) }} />)}{view.items.length === 0 && <p className="muted">Пока без подарков</p>}</div>} />
  </main>;
}
