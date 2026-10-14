// Запреты партнёрских программ на упоминание брендов и слов в рекламных ссылках.
// Источник: правила программ Lamoda и Золотое Яблоко в Admitad от 14.10.2026. Нарушение ведёт к отклонению заказов и отключению,
// поэтому при совпадении партнёрская ссылка не строится, а человека ведут в магазин по обычному адресу.
// Латинские слова сравниваются целиком, кириллические — по началу слова (учитывают падежные окончания).

const LAMODA_TERMS = [
  "nike", "найк", "adidas", "адидас", "reebok", "рибок", "lacoste", "лакост", "swarovski", "сваровск", "oodji", "оджи",
  "red valentino", "kalashnikov", "калашников", "ostin", "monochrome", "krakatau", "tommy jeans", "black star", "12storeez",
  "banana republic", "bershka", "бершк", "gap", "incity", "lime", "marks spencer", "oysho", "pull bear", "sabellino",
  "stradivarius", "страдивариус", "superdry", "tezenis", "massimo dutti", "массимо дутти", "uterque", "agent provocateur",
  "агент провокатор", "скидк",
];

const GOLDAPPLE_TERMS = [
  "chanel", "шанел", "la prairie", "kiehl", "kiehls", "macadamia", "urban decay", "loewe", "лоэве", "hermes", "гермес",
  "santa maria novella", "holika holika", "beauty drugs", "tony moly", "тони моли", "lime crime", "zielinski", "kurkdjian",
  "dior", "диор", "kilian", "килиан", "bork", "борк",
];

const TERMS_BY_STORE: Record<string, readonly (readonly string[])[]> = {
  lamoda: LAMODA_TERMS.map((term) => term.split(" ")),
  goldapple: GOLDAPPLE_TERMS.map((term) => term.split(" ")),
};

const CYRILLIC = /[а-я]/;

function tokenize(text: string): string[] {
  let decoded = text;
  try {
    decoded = decodeURIComponent(text);
  } catch {
    // Некорректная процентная кодировка: проверяем как есть
  }
  return decoded.toLowerCase().replaceAll("ё", "е").replace(/['’`]/g, "").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function matchesAt(tokens: readonly string[], start: number, term: readonly string[]): boolean {
  return term.every((part, offset) => {
    const token = tokens[start + offset];
    if (token === undefined) return false;
    return CYRILLIC.test(part) ? token.startsWith(part) : token === part;
  });
}

export function violatesPartnerRules(store: string | null, texts: readonly string[]): boolean {
  const terms = store ? TERMS_BY_STORE[store] : undefined;
  if (!terms) return false;
  return texts.some((text) => {
    const tokens = tokenize(text);
    return tokens.some((_, index) => terms.some((term) => matchesAt(tokens, index, term)));
  });
}
