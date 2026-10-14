// Если задан хоть один партнёрский шаблон, ссылки в магазины становятся рекламой и их нужно помечать.
// Формулировку и маркировку (erid) согласовать с партнёрской сетью до включения шаблонов.
export const AFFILIATE_NOTICE = "Реклама. Ссылки на магазины партнёрские: если вы купите товар, сервис может получить комиссию. Для вас цена не меняется.";

export function isAffiliateEnabled(): boolean {
  return Object.entries(process.env).some(([name, value]) => name.startsWith("AFFILIATE_") && Boolean(value?.trim()));
}
