import { getGoTarget, recordAffiliateClick } from "@wishlist/db";
import { redirect } from "next/navigation";
import { getDb } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function GiftGoPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const target = await getGoTarget(getDb(), itemId);
  if (!target) redirect("/gifts");

  await recordAffiliateClick(getDb(), { itemId: target.itemId, store: target.store });
  redirect(target.sourceUrl);
}
