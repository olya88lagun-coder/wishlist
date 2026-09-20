"use client";

import { useMemo, useState } from "react";
import type { WishlistSummary } from "@wishlist/db";
import { addGiftToWishlist } from "./actions";
import { trackEvent } from "@/lib/analytics";

type Result = {
  title: string;
  reason: string;
  type: string;
  productUrl?: string | null;
  store?: string | null;
  price?: string | null;
};

const PEOPLE = [["mom","Мама"],["dad","Папа"],["girlfriend","Девушка"],["boyfriend","Парень"],["wife","Жена"],["husband","Муж"],["friend","Друг / подруга"],["colleague","Коллега"],["sister","Сестра"],["brother","Брат"],["grandma","Бабушка"],["grandpa","Дедушка"],["daughter","Дочь"],["son","Сын"],["teacher","Учитель / учительница"],["boss","Руководитель"],["other","Другой человек"]] as const;
const OCCASIONS = [["birthday","День рождения"],["new-year","Новый год"],["anniversary","Годовщина"],["wedding","Свадьба"],["just-because","Просто так"],["other","Другой повод"]] as const;
const BUDGETS = [["3000","до 3 000 ₽"],["5000","до 5 000 ₽"],["10000","до 10 000 ₽"],["20000","до 20 000 ₽"],["custom","свой бюджет"]] as const;

type Person = (typeof PEOPLE)[number][0];

function makeIdeas(person: string, occasion: string, interests: string, budget: string): Result[] {
  const interest = interests.trim() || "любимые занятия";
  const who = PEOPLE.find(([value]) => value === person)?.[1] ?? "этого человека";
  const occasionName = OCCASIONS.find(([value]) => value === occasion)?.[1] ?? "особого повода";
  return [
    { title: `Подарок, связанный с ${interest}`, reason: `Для ${who.toLowerCase()}: идея учитывает ${interest} и подходит для ${occasionName.toLowerCase()}.`, type: "персональный", searchQuery: `${interest} подарок` },
    { title: "Подарок-впечатление", reason: `Подойдёт, если у человека уже многое есть: выберите впечатление вокруг ${interest}.`, type: "впечатление", searchQuery: `подарочный сертификат ${interest}` },
    { title: "Апгрейд любимого занятия", reason: `Практичная вещь для ${interest}, которую приятно получить к ${occasionName.toLowerCase()}.`, type: "практичный", searchQuery: `${interest} полезный аксессуар подарок` },
  ];
}                <div className="card__actions">
                  {[
                    ["Ozon", `https://www.ozon.ru/search/?text=${encodeURIComponent(result.searchQuery)}`],
                    ["Wildberries", `https://www.wildberries.ru/catalog/0/search.aspx?search=${encodeURIComponent(result.searchQuery)}`],
                    ["Яндекс Маркет", `https://market.yandex.ru/search?text=${encodeURIComponent(result.searchQuery)}`],
                  ].map(([store, url]) => (
                    <a
                      key={store}
                      className="button button--ghost button--small"
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackEvent("gift_finder_product_click", { store })}
                    >
                      {store}
                    </a>
                  ))}
                  {saveButton(result)}
                  <button className="button button--ghost button--small" type="button" onClick={() => {
                    trackEvent("gift_finder_dismiss", {});
                    setResults((current) => current.filter((item) => item.title !== result.title));
                  }}>Не моё</button>
                </div>

