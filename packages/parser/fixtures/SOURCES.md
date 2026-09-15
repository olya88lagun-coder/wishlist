# Фикстуры страниц магазинов

Сняты с сервера Timeweb (Москва) командой `curl -L -A <UA> -H "Accept-Language: ru-RU"`. Используются только в тестах парсера.
Обновлять, когда магазин меняет вёрстку и тесты `real-fixtures.test.ts` перестают отражать реальность.

| Файл | URL | User-Agent | Дата |
|---|---|---|---|
| wildberries.html | https://www.wildberries.ru/catalog/173937886/detail.aspx | WhatsApp/2.23.20.0 | 2026-09-15 |
| goldapple.html | https://goldapple.ru/19000378828-cardamom-moss | WhatsApp/2.23.20.0 | 2026-09-15 |

Заметки:
- Золотое Яблоко: JSON-LD только `OfferShippingDetails` (без Product); цена в microdata, первый `itemprop="price"` на странице — `content="0"` (кнопка цены для гостя), реальная цена идёт следующей.
- Яндекс Маркет: каталог рендерится скриптами, ссылок на товары в HTML нет — фикстура товара снимается по ссылке, присланной вручную.
