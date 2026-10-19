type AnalyticsTrafficContext = {
  location: { search: string };
  sessionStorage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  __wlAnalyticsTestTraffic?: boolean;
  __wlAnalyticsTestTrafficStorageFailed?: boolean;
};

type MetrikaContext = {
  __wlMetrikaStarted?: boolean;
  __wlMetrikaReady?: boolean;
  ym?: ((id: number, action: string, ...args: unknown[]) => void) & { a?: unknown[] };
};

declare global {
  interface Window {
    __wlAnalyticsTestTraffic?: boolean;
    __wlAnalyticsTestTrafficStorageFailed?: boolean;
    __wlLoadMetrika?: () => void;
    __wlMetrikaStarted?: boolean;
  }
}

// Функция самодостаточна: тот же код выполняется в inline-загрузчике до tag.js.
export function isAnalyticsTestTraffic(target: AnalyticsTrafficContext = window): boolean {
  const marker = new URLSearchParams(target.location.search).get("analytics_test");
  const key = "wl_analytics_test";
  let marked = target.__wlAnalyticsTestTraffic ?? false;
  if (marker === "1" || marker === "0") {
    marked = marker === "1";
    try {
      if (marked) target.sessionStorage.setItem(key, "1");
      else target.sessionStorage.removeItem(key);
      target.__wlAnalyticsTestTrafficStorageFailed = false;
    } catch {
      target.__wlAnalyticsTestTrafficStorageFailed = true;
    }
  } else if (!target.__wlAnalyticsTestTrafficStorageFailed) {
    try { marked = target.sessionStorage.getItem(key) === "1"; }
    catch { target.__wlAnalyticsTestTrafficStorageFailed = true; }
  }
  target.__wlAnalyticsTestTraffic = marked;
  return marked;
}

// Официальное выключение SPA-счётчика: https://yandex.ru/support/metrica/ru/code/counter-spa-setup
// Как и reader выше, эта функция сериализуется в inline-загрузчик без внешних зависимостей.
export function stopMetrikaForTestTraffic(id: number, target: MetrikaContext = window): void {
  const wasStarted = target.__wlMetrikaStarted;
  const wasReady = target.__wlMetrikaReady;
  const hasCounter = Boolean(Reflect.get(target, `yaCounter${id}`));
  target.__wlMetrikaReady = false;
  target.__wlMetrikaStarted = false;
  const ym = target.ym;
  if (typeof ym !== "function") return;
  const buffered = ym.a;
  if (Array.isArray(buffered)) {
    // Меняем массив на месте: загруженная библиотека наблюдает именно за этим ym.a.
    for (let index = buffered.length - 1; index >= 0; index--) {
      const call = buffered[index] as { 0?: unknown } | null | undefined;
      if (call?.[0] === id || call?.[0] === String(id)) buffered.splice(index, 1);
    }
  }
  if (!wasStarted && !wasReady && !hasCounter) return;
  // До загрузки tag.js достаточно убрать init. Отложенный destruct уничтожил бы
  // будущий счётчик при явном analytics_test=0, поэтому его не ставим в очередь.
  if (wasReady || hasCounter || !Array.isArray(buffered)) {
    try { ym(id, "destruct"); }
    catch { /* Аналитика не должна мешать работе страницы. */ }
  }
}

export function metrikaLoaderScript(id: number): string {
  return `
    (function() {
      var testTraffic = (${isAnalyticsTestTraffic.toString()});
      var stopCounter = (${stopMetrikaForTestTraffic.toString()});
      window.__wlLoadMetrika = function() {
        if (testTraffic(window)) { stopCounter(${id}, window); return; }
        if (window.__wlMetrikaStarted) return;
        window.__wlMetrikaStarted = true;
        (function(m,e,t,r,i,k,a){
          m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
          m[i].l=1*new Date();
          for (var j = 0; j < document.scripts.length; j++) {
            if (document.scripts[j].src === r) return;
          }
          k=e.createElement(t),a=e.getElementsByTagName(t)[0],
          k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
        })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js?id=${id}", "ym");
        window.ym(${id}, "init", {
          ssr: true,
          triggerEvent: true,
          webvisor: false,
          clickmap: true,
          ecommerce: "dataLayer",
          referrer: document.referrer,
          url: window.location.href,
          accurateTrackBounce: true,
          trackLinks: true
        });
      };
      window.__wlLoadMetrika();
    })();
  `;
}
