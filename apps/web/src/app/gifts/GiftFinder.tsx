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

const PEOPLE = [["mom","Мама"],["dad","Папа"],["girlfriend","Девушка"],["boyfriend","Парень"],["wife","Жена"],["husband","Муж"],["friend","Друг / подруга"],["colleague","Коллега"],["other","Другой человек"]] as const;
const OCCASIONS = [["birthday","День рождения"],["new-year","Новый год"],["anniversary","Годовщина"],["wedding","Свадьба"],["just-because","Просто так"],["other","Другой повод"]] as const;
const BUDGETS = [["3000","до 3 000 ₽"],["5000","до 5 000 ₽"],["10000","до 10 000 ₽"],["20000","до 20 000 ₽"],["custom","свой бюджет"]] as const;

type Person = (typeof PEOPLE)[number][0];

function makeIdeas(person: string, occasion: string, interests: string, budget: string): Result[] {
  const interest = interests.trim() || "любимые занятия";
  const who = PEOPLE.find(([value]) => value === person)?.[1] ?? "этого человека";
  const occasionName = OCCASIONS.find(([value]) => value === occasion)?.[1] ?? "особого повода";
  const budgetName = BUDGETS.find(([value]) => value === budget)?.[1] ?? "вашего бюджета";
  return [
    { title: `Персональный подарок про ${interest}`, reason: `Для ${who.toLowerCase()}: идея учитывает ${interest} и подходит для повода «${occasionName.toLowerCase()}» в рамках ${budgetName.toLowerCase()}.`, type: "персональный" },
    { title: "Впечатление вместо вещи", reason: `Подойдёт, если у человека уже всё есть: выберите впечатление, связанное с ${interest}.`, type: "впечатление" },
    { title: "Небольшой апгрейд любимого занятия", reason: `Полезная вещь для ${interest}, которую приятно получить именно к ${occasionName.toLowerCase()}.`, type: "практичный" },
  ];
}

export function GiftFinder({ wishlists, isAuthenticated = false, initialPerson = "mom" }: { wishlists: WishlistSummary[]; isAuthenticated?: boolean; initialPerson?: Person }) {
  const [person, setPerson] = useState<Person>(initialPerson);
  const [occasion, setOccasion] = useState("birthday");
  const [interests, setInterests] = useState("");
  const [budget, setBudget] = useState("5000");
  const [customBudget, setCustomBudget] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [addingTitle, setAddingTitle] = useState<string | null>(null);
  const [addedItems, setAddedItems] = useState<Record<string, string>>({});
  const [addError, setAddError] = useState("");
  const [openWishlistFor, setOpenWishlistFor] = useState<string | null>(null);

  const effectiveBudget = budget === "custom" ? customBudget || "свой бюджет" : budget;
  const ideas = useMemo(() => makeIdeas(person, occasion, interests, effectiveBudget), [person, occasion, interests, effectiveBudget]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSubmitted(false);
    trackEvent("gift_finder_submit", { person, occasion, budget: effectiveBudget });
    try {
      const response = await fetch("/api/gifts/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person, occasion, interests, budget: effectiveBudget }),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (payload.code === "AI_NOT_CONFIGURED") {
          setResults(ideas);
          setSubmitted(true);
          trackEvent("gift_finder_result", { count: ideas.length, source: "demo" });
          setError("AI ещё не подключён в окружении. Показываем демо-подборку.");
        } else {
          throw new Error(payload.error || "Не удалось подобрать подарки");
        }
      } else {
        setResults(payload.ideas);
        setSubmitted(true);
        trackEvent("gift_finder_result", { count: payload.ideas.length, source: "ai" });
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось подобрать подарки");
    } finally {
      setLoading(false);
    }
  }

  async function addToWishlist(result: Result, wishlistId: string) {
    setAddingTitle(result.title);
    setAddError("");
    const response = await addGiftToWishlist({
      wishlistId,
      title: result.title,
      productUrl: result.productUrl ?? null,
      note: result.reason,
    });
    setAddingTitle(null);
    if (!response.ok) {
      setAddError(response.message);
      return;
    }
    setAddedItems((current) => ({ ...current, [result.title]: response.itemId }));
    trackEvent("gift_finder_save", { store: result.store ?? "unknown" });
    setOpenWishlistFor(null);
  }

  function saveButton(result: Result) {
    if (Object.prototype.hasOwnProperty.call(addedItems, result.title)) {
      return <span className="button button--small" aria-label="Подарок уже добавлен">✓ Добавлено</span>;
    }
    if (wishlists.length === 0) {
      return isAuthenticated
        ? <a className="button button--small" href="/lists">Создать вишлист</a>
        : <a className="button button--small" href="/login">Войти и сохранить</a>;
    }
    return (
      <div className="gift-card__save">
        <button
          className="button button--small"
          type="button"
          onClick={() => setOpenWishlistFor(openWishlistFor === result.title ? null : result.title)}
        >
          Добавить в вишлист
        </button>
        {openWishlistFor === result.title && (
          <div className="gift-card__wishlists" role="group" aria-label={`Выберите вишлист для «${result.title}»`}>
            <span className="muted">Куда добавить?</span>
            {wishlists.map((wishlist) => (
              <button
                key={wishlist.id}
                className="button button--ghost button--small"
                type="button"
                disabled={addingTitle === result.title}
                onClick={() => addToWishlist(result, wishlist.id)}
              >
                {wishlist.title}
              </button>
            ))}
            <a className="muted gift-card__new-list" href="/lists">+ Создать новый вишлист</a>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="gift-finder">
      <form className="panel gift-finder__form" onSubmit={submit}>
        <div className="gift-finder__intro">
          <span className="sticker sticker--countdown">AI gift finder</span>
          <p className="muted" style={{ margin: 0 }}>4 коротких шага · без регистрации</p>
        </div>

        <div className="field">
          <label htmlFor="gift-person">Для кого подарок?</label>
          <select id="gift-person" className="select" value={person} onChange={(e) => setPerson(e.target.value as Person)}>
            {PEOPLE.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        <div className="field">
          <label htmlFor="gift-occasion">Какой повод?</label>
          <select id="gift-occasion" className="select" value={occasion} onChange={(e) => setOccasion(e.target.value)}>
            {OCCASIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        <div className="field">
          <label htmlFor="gift-interests">Что человек любит?</label>
          <textarea id="gift-interests" className="textarea" value={interests} onChange={(e) => setInterests(e.target.value)} placeholder="Например: кофе, бег, книги, уход за собой, путешествия" />
        </div>

        <div className="field">
          <label htmlFor="gift-budget">Бюджет</label>
          <select id="gift-budget" className="select" value={budget} onChange={(e) => setBudget(e.target.value)}>
            {BUDGETS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        {budget === "custom" && (
          <div className="field">
            <label htmlFor="gift-custom-budget">Ваш бюджет</label>
            <input id="gift-custom-budget" className="input" inputMode="numeric" value={customBudget} onChange={(e) => setCustomBudget(e.target.value)} placeholder="Например, 7000 ₽" />
          </div>
        )}

        <button className="button button--block" type="submit" disabled={loading}>{loading ? "Подбираем…" : "Подобрать идеи"}</button>
        {error && <p className="error" role="status">{error}</p>}
      </form>

      {submitted && (
        <section className="gift-finder__results" aria-live="polite">
          <div className="row row--between">
            <div>
              <p className="eyebrow">Подборка</p>
              <h2 className="gift-finder__title">Вот с чего можно начать</h2>
            </div>
            <span className="sticker sticker--reserved">{results.length} идеи</span>
          </div>
          {addError && <p className="error" role="status">{addError}</p>}
          <div className="gift-finder__cards">
            {results.map((result) => (
              <article className="panel gift-card" key={result.title}>
                <span className="eyebrow">{result.type}</span>
                <h3>{result.title}</h3>
                <p className="muted">{result.reason}</p>
                {(result.store || result.price) && <p className="card__meta">{[result.store, result.price].filter(Boolean).join(" · ")}</p>}
                <div className="card__actions">
                  {result.productUrl && (
                    <a
                      className="button button--ghost button--small"
                      href={addedItems[result.title] ? `/go/${addedItems[result.title]}` : result.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackEvent("gift_finder_product_click", { store: result.store ?? "unknown" })}
                    >
                      Открыть товар
                    </a>
                  )}
                  {saveButton(result)}
                  <button className="button button--ghost button--small" type="button" onClick={() => { trackEvent("gift_finder_dismiss", { store: result.store ?? "unknown" }); setResults((current) => current.filter((item) => item.title !== result.title)); }}>Не моё</button>
                </div>
                {addingTitle === result.title && <p className="muted" role="status">Добавляем…</p>}
              </article>
            ))}
          </div>
          <p className="muted gift-finder__note">Нашли подходящий подарок — сохраните его в вишлист. Ссылка, название и заметка попадут в ваш список, а данные товара подтянутся из магазина.</p>
        </section>
      )}
    </section>
  );
}
