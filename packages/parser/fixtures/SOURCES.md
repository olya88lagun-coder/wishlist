# Фикстуры страниц магазинов

Сняты с сервера Timeweb (Москва) командой `curl -L -A <UA> -H "Accept-Language: ru-RU"`. Используются только в тестах парсера.
Обновлять, когда магазин меняет вёрстку и тесты `real-fixtures.test.ts` перестают отражать реальность.

| Файл | URL | User-Agent | Дата |
|---|---|---|---|
| wildberries.html | https://www.wildberries.ru/catalog/173937886/detail.aspx | WhatsApp/2.23.20.0 | 2026-09-15 |
| goldapple.html | https://goldapple.ru/19000378828-cardamom-moss | WhatsApp/2.23.20.0 | 2026-09-15 |
| yandex-market.html | https://market.yandex.ru/card/elektrochaynik-s-dvoynymi-stenkami-kolboy-iz-nerzhaveyushchey-stali-vyborom-temperatury-tuvio-tkp1517s-terrakota/103830995648 | vkShare; +http://vk.com/dev/Share | 2026-09-15 |

Заметки:
- Золотое Яблоко: JSON-LD только `OfferShippingDetails` (без Product). Название и цена — в microdata Product (`h1 itemprop="name"`); внутри Product есть хлебные крошки со своими `itemprop="name"`, а на странице — `SoftwareApplication` с `price content="0"`. OG-заголовок начинается с «В наличии: ».
- Яндекс Маркет: каталог рендерится скриптами, ссылок на товары в HTML нет — карточка снята по ссылке пользователя. На `TelegramBot` и `Twitterbot` UA Маркет с сервера редиректит на `/showcaptcha` (страница с og:title «Яндекс»); `vkShare`, `facebookexternalhit`, `YandexBot` получают карточку. В карточке JSON-LD `Product` с `Offer` самой карточки (цена надёжна); суммы в тексте страницы — рекомендации.
