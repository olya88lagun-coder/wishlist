import { trackEvent } from "./analytics";

// Только несекретные подтверждения завершённых действий. Сессии и данные списков здесь не читаются.
export function collectAnalyticsCompletions() {
  let cookie: string;
  try { cookie = document.cookie; } catch { return; }
  for (const part of cookie.split(";")) {
    const separator = part.indexOf("=");
    const name = part.slice(0, separator).trim();
    if (!/^wl_goal_[a-f0-9]{32}$/.test(name)) continue;
    try {
      document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax; Secure`;
      const receipt = JSON.parse(decodeURIComponent(part.slice(separator + 1)));
      // Max-Age cookie задаёт срок жизни без сравнения часов сервера и устройства.
      if (receipt.event === "auth_completed" && ["telegram", "vk", "telegram_miniapp"].includes(receipt.params?.provider)) {
        trackEvent("auth_completed", { provider: receipt.params.provider });
      } else if (receipt.event === "wishlist_created" && ["finder", "direct"].includes(receipt.params?.source)) {
        trackEvent("wishlist_created", { source: receipt.params.source });
      }
    } catch { /* Повреждённое подтверждение не мешает странице. */ }
  }
}
