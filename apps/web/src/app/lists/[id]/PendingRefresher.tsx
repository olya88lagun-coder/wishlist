"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export const POLL_INTERVAL_MS = 2000;
export const MAX_POLL_MS = 90_000;

export function PendingRefresher({ pendingCount }: { pendingCount: number }) {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    if (pendingCount === 0) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - startedAt > MAX_POLL_MS) {
        clearInterval(timer);
        setGaveUp(true);
        return;
      }
      router.refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pendingCount, router]);

  if (pendingCount === 0 || !gaveUp) return null;
  return (
    <p className="muted" role="status">
      Магазин долго не отвечает. Заполните подарок вручную через «Изменить» — данные из магазина подтянутся, если он ответит позже.
    </p>
  );
}
