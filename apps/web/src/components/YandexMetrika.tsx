import Script from "next/script";

export function YandexMetrika() {
  const id = process.env.YANDEX_METRIKA_ID;
  if (!id) return null;

  return (
    <>
      <Script id="yandex-metrika" strategy="afterInteractive">
        {`
          (function(m,e,t,r,i,k,a){
            m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            k=e.createElement(t),a=e.getElementsByTagName(t)[0];
            k.async=1;k.src=r+"?id="+i;a.parentNode.insertBefore(k,a)
          })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "${id}");
          ym(${id}, "init", {
            clickmap: true,
            trackLinks: true,
            accurateTrackBounce: true,
            webvisor: true,
            ssr: true
          });
        `}
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