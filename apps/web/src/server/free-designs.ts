// Telegram ID владельцев, которым все платные оформления доступны без оплаты.
// Только цифры: любое другое значение отбрасывается, чтобы опечатка не открыла доступ всем.
export function parseFreeDesignTelegramIds(raw: string | undefined): string[] {
  return (raw ?? "").split(",").map((part) => part.trim()).filter((part) => /^\d{1,20}$/.test(part));
}

export function freeDesignTelegramIds(source: Record<string, string | undefined> = process.env): string[] {
  return parseFreeDesignTelegramIds(source.FREE_DESIGN_TELEGRAM_IDS);
}
