import { AFFILIATE_NOTICE, isAffiliateEnabled } from "@/server/affiliate-notice";

export function AffiliateNotice() {
  if (!isAffiliateEnabled()) return null;
  return (
    <p className="affiliate-notice" role="note">
      {AFFILIATE_NOTICE}
    </p>
  );
}
