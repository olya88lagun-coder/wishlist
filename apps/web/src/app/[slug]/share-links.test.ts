import { expect, test } from "vitest";
import { shareLinks } from "./share-links";

const LIST_URL = "https://my-wish-list.online/AbCdEfGhIj";
const TITLE = "Маше 30 — вишлист";

test("every target gets the list link and title, safely encoded", () => {
  const links = shareLinks(LIST_URL, TITLE);
  expect(links.map((l) => l.id)).toEqual(["telegram", "vk", "max"]);
  for (const link of links) {
    expect(new URL(link.url).protocol).toBe("https:");
    expect(link.url).toContain(encodeURIComponent(LIST_URL));
    expect(link.url).not.toContain(" ");
  }
});

test("known addresses of the messengers", () => {
  const [telegram, vk, max] = shareLinks(LIST_URL, TITLE);
  expect(telegram!.url).toBe(`https://t.me/share/url?url=${encodeURIComponent(LIST_URL)}&text=${encodeURIComponent(TITLE)}`);
  expect(vk!.url).toBe(`https://vk.com/share.php?url=${encodeURIComponent(LIST_URL)}&title=${encodeURIComponent(TITLE)}`);
  expect(max!.url).toBe(`https://max.ru/:share?text=${encodeURIComponent(`${TITLE} ${LIST_URL}`)}`);
  expect([telegram!.label, vk!.label, max!.label]).toEqual(["Telegram", "VK", "MAX"]);
});
