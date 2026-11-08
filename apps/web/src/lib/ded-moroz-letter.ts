import { z } from "zod";
import { isSingleLine, printableText } from "./invitation";

const singleLine = (max: number) => z.string().trim().max(max, `Не больше ${max} символов`)
  .refine(isSingleLine, "Введите текст в одну строку");

export const dedMorozLetterSchema = z.strictObject({
  name: singleLine(30).min(1, "Укажите имя ребёнка").transform(printableText).refine(Boolean, "Напишите имя кириллицей или латиницей"),
  gender: z.enum(["boy", "girl"], { error: "Выберите, кому письмо" }),
  age: z.string().trim().regex(/^(?:[1-9]|1[0-7])$/, "Возраст от 1 до 17"),
  achievements: z.array(singleLine(70).transform(printableText)).max(3).default([]).transform((list) => list.filter(Boolean)),
  gift: singleLine(60).transform(printableText).optional(),
  wish: z.string().trim().max(160, "Не больше 160 символов")
    .refine((value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(value), "Уберите служебные символы").transform(printableText).optional(),
});

export type DedMorozLetterInput = z.input<typeof dedMorozLetterSchema>;
// initial: первая буква имени для печати; "" если имя начинается не с кириллицы или латиницы (шрифт их не покажет)
export type DedMorozLetter = { greeting: string; paragraphs: string[]; signoff: string; initial: string };

function nameInitial(name: string): string {
  const first = name.trim().match(/^[A-Za-zА-ЯЁа-яё]/u)?.[0];
  return first ? first.toUpperCase() : "";
}

// «Научилась плавать» → «научилась плавать»: достижение встаёт в середину фразы
function inline(text: string): string {
  return /^\p{Lu}\p{Ll}/u.test(text) ? text[0]!.toLowerCase() + text.slice(1) : text;
}

function joinRu(items: string[]): string {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} и ${items.at(-1)}`;
}

function sentence(text: string): string {
  return /[.!?…]$/u.test(text) ? text : `${text}.`;
}

// Три возрастных шаблона без ИИ: текст всегда предсказуем, а родитель видит его до покупки
export function dedMorozLetterText(raw: DedMorozLetterInput): DedMorozLetter {
  const input = dedMorozLetterSchema.parse(raw);
  const girl = input.gender === "girl";
  const g = (boy: string, her: string) => (girl ? her : boy);
  const age = Number(input.age);
  const deeds = joinRu(input.achievements.map(inline));
  const gift = input.gift?.trim();
  const wish = input.wish?.trim();

  if (age <= 5) return {
    greeting: `${g("Дорогой", "Дорогая")} ${input.name}!`,
    paragraphs: [
      `Пишу тебе из своего снежного терема. Мои помощники-снеговики рассказали, что весь год ты ${g("рос смелым и добрым", "росла смелой и доброй")}.`,
      deeds ? `Я знаю, что в этом году ты ${sentence(deeds)} Я очень тобой горжусь!` : `Я знаю, что в этом году ты многому ${g("научился", "научилась")}. Я очень тобой горжусь!`,
      gift ? `Я прочитал твоё письмо и запомнил главное желание: ${sentence(gift)} Мои помощники уже готовят подарки, а в новогоднюю ночь я загляну к тебе.` : "Мои помощники уже упаковывают подарки, а в новогоднюю ночь я загляну к тебе.",
      wish ? sentence(wish) : "Слушай маму и папу, ложись спать вовремя и обязательно загадай желание под бой курантов.",
    ],
    signoff: "Твой Дедушка Мороз",
    initial: nameInitial(input.name),
  };

  if (age <= 9) return {
    greeting: `Здравствуй, ${g("дорогой", "дорогая")} ${input.name}!`,
    paragraphs: [
      "В моём лесу уже лежат высокие сугробы, олени готовят сани, а Снегурочка проверяет списки подарков. Твоё имя в этом списке я нашёл сразу.",
      deeds ? `Весь год я следил за тобой через волшебное окошко. Ты ${sentence(deeds)} Такое не каждому под силу!` : `Весь год я следил за тобой через волшебное окошко и видел, как ты ${g("старался", "старалась")}. Такое не каждому под силу!`,
      gift ? `Твоё письмо дошло до меня. Про твоё желание — ${gift} — я не забуду и постараюсь его исполнить.` : "Скоро я отправлюсь в путь, чтобы успеть ко всем ребятам до боя курантов.",
      wish ? sentence(wish) : `Пусть новый год будет весёлым и интересным, а рядом всегда будут друзья. Я верю, что у тебя всё получится.`,
    ],
    signoff: "С любовью, Дед Мороз",
    initial: nameInitial(input.name),
  };

  return {
    greeting: `Здравствуй, ${input.name}!`,
    paragraphs: [
      `Ты уже ${g("совсем взрослый", "совсем взрослая")}, но я всё равно решил написать тебе письмо. Новый год — хороший повод оглянуться назад и порадоваться тому, что получилось.`,
      deeds ? `А получилось многое: ты ${sentence(deeds)} За этим стоят твой труд и твоё упорство.` : `За этот год ты многое ${g("сделал", "сделала")} сам${g("", "а")}, и за этим стоят твой труд и твоё упорство.`,
      gift ? `Я знаю, что ты хочешь на Новый год: ${sentence(gift)} Посмотрим, что окажется под ёлкой.` : "Посмотрим, что окажется под ёлкой этой ночью.",
      wish ? sentence(wish) : "Пусть в новом году хватит сил на всё задуманное, а рядом будут люди, которые в тебя верят.",
    ],
    signoff: "Твой Дед Мороз",
    initial: nameInitial(input.name),
  };
}
