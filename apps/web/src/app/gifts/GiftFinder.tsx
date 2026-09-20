"use client";

import { useMemo, useState } from "react";

type Result = { title: string; reason: string; type: string };

const PEOPLE = [["mom","Мама"],["dad","Папа"],["girlfriend","Девушка"],["boyfriend","Парень"],["wife","Жена"],["husband","Муж"],["friend","Друг / подруга"],["colleague","Коллега"],["other","Другой человек"]] as const;
const OCCASIONS = [["birthday","День рождения"],["new-year","Новый год"],["anniversary","Годовщина"],["wedding","Свадьба"],["just-because","Просто так"],["other","Другой повод"]] as const;
const BUDGETS = [["3000","до 3 000 ₽"],["5000","до 5 000 ₽"],["10000","до 10 000 ₽"],["20000","до 20 000 ₽"],["custom","свой бюджет"]] as const;

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

export function GiftFinder() {
  const [person, setPerson] = useState("mom");
  const [occasion, setOccasion] = useState("birthday");
  const [interests, setInterests] = useState("");
  const [budget, setBudget] = useState("5000");
  const [customBudget, setCustomBudget] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const effectiveBudget = budget === "custom" ? customBudget || "свой бюджет" : budget;
  const ideas = useMemo(() => makeIdeas(person, occasion, interests, effectiveBudget), [person, occasion, interests, effectiveBudget]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setResults(ideas);
    setSubmitted(true);
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
          <select id="gift-person" className="select" value={person} onChange={(e) => setPerson(e.target.value)}>
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

        <button className="button button--block" type="submit">Подобрать идеи</button>
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
          <div className="gift-finder__cards">
            {results.map((result) => (
              <article className="panel gift-card" key={result.title}>
                <span className="eyebrow">{result.type}</span>
                <h3>{result.title}</h3>
                <p className="muted">{result.reason}</p>
                <div className="card__actions">
                  <a className="button button--small" href="/lists">Добавить в вишлист</a>
                  <button className="button button--ghost button--small" type="button" onClick={() => setResults((current) => current.filter((item) => item.title !== result.title))}>Не моё</button>
                </div>
              </article>
            ))}
          </div>
          <p className="muted gift-finder__note">Сейчас это интерфейс первого этапа. Следующим шагом подключим AI и каталог реальных товаров, чтобы карточки вели прямо к покупке.</p>
        </section>
      )}
    </section>
  );
}
