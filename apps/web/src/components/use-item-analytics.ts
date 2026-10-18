"use client";

import { useEffect, useRef } from "react";
import type { FormState } from "@/app/lists/form-state";
import { trackEvent } from "@/lib/analytics";

export function useItemAnalytics(state: FormState) {
  const seen = useRef<string | null>(null);
  useEffect(() => {
    const receipt = state.analyticsReceipt;
    if (state.status !== "success" || !receipt || seen.current === receipt.nonce) return;
    seen.current = receipt.nonce;
    trackEvent("wishlist_item_added", { source: receipt.source });
  }, [state]);
}
