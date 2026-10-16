// Запреты партнёрских программ на упоминание брендов и слов в рекламных ссылках.
// Источник: правила программ Lamoda, Золотое Яблоко и ЛЭТУАЛЬ в Admitad от 14.10.2026. Нарушение ведёт к отклонению заказов и отключению,
// поэтому при совпадении партнёрская ссылка не строится, а человека ведут в магазин по обычному адресу.
// Латинские слова сравниваются целиком, кириллические — по началу слова (учитывают падежные окончания), если в слове от 4 букв;
// более короткие кириллические слова сравниваются целиком, чтобы «том» не совпадал с «томат».

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

// У ЛЭТУАЛЬ магазина в списке магазинов пока нет: запреты готовы к его подключению. «Клиник» и «мак» по-русски не включены:
// совпали бы с обычными словами («клиника», «макияж»).
const LETUAL_TERMS = [
  "chanel", "шанел", "dior", "диор", "kilian", "килиан", "givenchy", "живанши", "guerlain", "герлен", "kenzo", "кензо",
  "estee lauder", "эсте лаудер", "эстэ лаудер", "clinique", "tom ford", "том форд", "bobbi brown", "бобби браун",
  "jo malone", "джо малон", "la mer", "mac",
];

// AliExpress просит не использовать уничижительные слова о товарах и не сравнивать товары с копиями известных брендов
// (условия сотрудничества партнёров с AliExpress Россия, 16.10.2026). «Дешёвый» и «недорогой» разрешены, поэтому в списке только
// «дешевка» и «дешевизна». Короткие русские слова вроде «лего» не берём: совпали бы с «легонький».
const ALIEXPRESS_TERMS = [
  "халяв", "дешевк", "дешевизн",
  "nike", "найк", "adidas", "адидас", "puma", "reebok", "zara", "gucci", "гуччи", "chanel", "шанел", "dior", "диор", "prada",
  "versace", "версаче", "louis vuitton", "lego", "apple", "iphone", "айфон", "airpods", "эйрподс", "dyson", "дайсон", "stanley",
];

const TERMS_BY_STORE: Record<string, readonly (readonly string[])[]> = {
  lamoda: LAMODA_TERMS.map((term) => term.split(" ")),
  goldapple: GOLDAPPLE_TERMS.map((term) => term.split(" ")),
  letual: LETUAL_TERMS.map((term) => term.split(" ")),
  aliexpress: ALIEXPRESS_TERMS.map((term) => term.split(" ")),
};

const CYRILLIC = /[а-я]/;
const MIN_STEM_LENGTH = 4;

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
    return CYRILLIC.test(part) && part.length >= MIN_STEM_LENGTH ? token.startsWith(part) : token === part;
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
