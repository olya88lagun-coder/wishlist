"use client";

import { useEffect, useState } from "react";
import {
  analyticsConsentGranted,
  readCookieConsent,
  writeCookieConsent,
  type CookieConsentValue,
} from "@/lib/cookie-consent";
import { initializeAnalytics } from "@/lib/analytics";
import { METRIKA_ID, validMetrikaId } from "@/lib/analytics-events";
import { stopMetrikaForTestTraffic } from "@/lib/analytics-test-traffic";
import "./cookie-consent.css";

function applyConsent(value: CookieConsentValue) {
  writeCookieConsent(value);
  if (value === "accepted") {
    window.__wlLoadMetrika?.();
    initializeAnalytics();
    return;
  }
  if (validMetrikaId) stopMetrikaForTestTraffic(METRIKA_ID);
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(readCookieConsent() === null);
    // Уже принятое согласие подхватывает отложенный загрузчик Метрики.
    if (analyticsConsentGranted()) window.__wlLoadMetrika?.();
  }, []);

  if (!visible) return null;

  const choose = (value: CookieConsentValue) => {
    applyConsent(value);
    setVisible(false);
  };

  return (
    <div className="cookie-consent" role="dialog" aria-label="Согласие на cookie" aria-live="polite">
      <p className="cookie-consent__copy">
        Cookie нужны для входа и, с вашего согласия, для статистики.{" "}
        <a href="/privacy">Подробнее</a>
      </p>
      <div className="cookie-consent__actions">
        <button type="button" className="cookie-consent__btn cookie-consent__btn--ghost" onClick={() => choose("rejected")}>
          Только нужные
        </button>
        <button type="button" className="cookie-consent__btn" onClick={() => choose("accepted")}>
          Принять
        </button>
      </div>
    </div>
  );
}
