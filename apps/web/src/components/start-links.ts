export const GUEST_START_PAYLOAD = "guest";

export type StartLink = { id: "telegram" | "site" | "lists"; label: string; href: string; external: boolean };

export function startLinks(botUsername: string, signedIn: boolean): StartLink[] {
  if (signedIn) return [{ id: "lists", label: "Открыть мои списки", href: "/lists", external: false }];
  return [
    { id: "telegram", label: "Собрать в Telegram", href: `https://t.me/${botUsername}?start=${GUEST_START_PAYLOAD}`, external: true },
    { id: "site", label: "Собрать на сайте", href: "/login", external: false },
  ];
}
