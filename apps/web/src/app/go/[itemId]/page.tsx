import { getAffiliateUrl, getGoTarget, recordAffiliateClick } from "@wishlist/db";
import { redirect } from "next/navigation";
import { getDb } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function GiftGoPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const db = getDb();
  const target = await getGoTarget(db, itemId);

  if (!target) redirect("/gifts");

  await recordAffiliateClick(db, { itemId: target.itemId, store: target.store });
  redirect(getAffiliateUrl(target.sourceUrl, target.store));
}
