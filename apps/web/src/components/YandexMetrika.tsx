"use client";

import Script from "next/script";
import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { initializeAnalytics } from "@/lib/analytics";
import { collectAnalyticsCompletions } from "@/lib/analytics-completions";
import { METRIKA_ID, validMetrikaId } from "@/lib/analytics-events";
import { metrikaLoaderScript } from "@/lib/analytics-test-traffic";

function AnalyticsContext() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    initializeAnalytics();
    collectAnalyticsCompletions();
    window.__wlLoadMetrika?.();
  }, [pathname, searchParams]);
  return null;
}

export function YandexMetrika() {
  const id = METRIKA_ID;
  if (!validMetrikaId) return null;

  return (
    <>
      <Suspense fallback={null}><AnalyticsContext /></Suspense>
      <Script id="yandex-metrika" strategy="lazyOnload">
        {metrikaLoaderScript(id)}
      </Script>
      <noscript>
        <div>
          <img
            src={"https://mc.yandex.ru/watch/" + id}
            style={{ position: "absolute", left: "-9999px" }}
            alt=""
          />
        </div>
      </noscript>
    </>
  );
}
