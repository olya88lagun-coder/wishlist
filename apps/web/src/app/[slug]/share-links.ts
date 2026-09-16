export type ShareTarget = { id: "telegram" | "vk" | "max"; label: string; url: string };

// MAX принимает только текст, поэтому ссылка идёт внутри него
export function shareLinks(url: string, title: string): ShareTarget[] {
  const link = encodeURIComponent(url);
  return [
    { id: "telegram", label: "Telegram", url: `https://t.me/share/url?url=${link}&text=${encodeURIComponent(title)}` },
    { id: "vk", label: "VK", url: `https://vk.com/share.php?url=${link}&title=${encodeURIComponent(title)}` },
    { id: "max", label: "MAX", url: `https://max.ru/:share?text=${encodeURIComponent(`${title} ${url}`)}` },
  ];
}
