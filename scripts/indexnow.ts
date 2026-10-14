// Отправляет адреса из sitemap.xml в IndexNow. Запуск: node scripts/indexnow.ts
// Адрес сайта по умолчанию рабочий, для проверки можно задать SITE_URL.
import { INDEXNOW_ENDPOINT, INDEXNOW_KEY, indexNowPayload, sitemapUrls } from "../apps/web/src/server/indexnow.ts";

const origin = (process.env.SITE_URL ?? "https://my-wish-list.online").replace(/\/$/, "");
const host = new URL(origin).host;

// Поисковик сам откроет файл с ключом, поэтому до отправки убеждаемся, что он уже опубликован
const keyResponse = await fetch(`${origin}/${INDEXNOW_KEY}.txt`);
if (!keyResponse.ok || (await keyResponse.text()).trim() !== INDEXNOW_KEY) {
  console.error(`Файл ключа ${origin}/${INDEXNOW_KEY}.txt недоступен или не совпадает. Сначала задеплойте сайт.`);
  process.exit(1);
}

const sitemapResponse = await fetch(`${origin}/sitemap.xml`);
if (!sitemapResponse.ok) {
  console.error(`sitemap.xml ответил ${sitemapResponse.status}`);
  process.exit(1);
}

const payload = indexNowPayload(host, INDEXNOW_KEY, sitemapUrls(await sitemapResponse.text()));
if (payload.urlList.length === 0) {
  console.error("В sitemap.xml нет адресов этого сайта.");
  process.exit(1);
}

const response = await fetch(INDEXNOW_ENDPOINT, {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify(payload),
});
console.log(`IndexNow: отправлено ${payload.urlList.length} адресов, ответ ${response.status}`);
// 200 и 202 означают, что адреса приняты (202 ещё проверяет ключ)
if (response.status !== 200 && response.status !== 202) {
  console.error(await response.text());
  process.exit(1);
}
