import type { FieldErrors } from "@/server/forms";
import type { FormState } from "../form-state";

export type ItemDefaults = { title: string; url: string; price: string; note: string; isMustHave: boolean };

// После ошибки показываем то, что пользователь отправил, иначе — исходные значения
export function itemDefaultsFor(state: FormState, fallback: ItemDefaults): ItemDefaults {
  if (state.status !== "error") return fallback;
  const { values } = state;
  return { title: values.title ?? "", url: values.url ?? "", price: values.price ?? "", note: values.note ?? "", isMustHave: values.isMustHave === "on" };
}

export function ItemFields({ idPrefix, defaults, errors }: { idPrefix: string; defaults: ItemDefaults; errors: FieldErrors }) {
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <>
      <div className="field">
        <label htmlFor={id("url")}>Ссылка на товар</label>
        <input id={id("url")} name="url" type="url" inputMode="url" className="input" placeholder="https://www.wildberries.ru/…" defaultValue={defaults.url} aria-invalid={errors.url ? true : undefined} aria-describedby={errors.url ? id("url-error") : undefined} />
        {errors.url && <p id={id("url-error")} className="error">{errors.url}</p>}
      </div>
      <div className="field">
        <label htmlFor={id("title")}>Что подарить</label>
        <input id={id("title")} name="title" className="input" placeholder="Наушники Sony" maxLength={200} defaultValue={defaults.title} aria-invalid={errors.title ? true : undefined} aria-describedby={errors.title ? id("title-error") : undefined} />
        {errors.title && <p id={id("title-error")} className="error">{errors.title}</p>}
      </div>
      <div className="field">
        <label htmlFor={id("price")}>Цена, ₽</label>
        <input id={id("price")} name="price" inputMode="decimal" className="input" placeholder="2 490" defaultValue={defaults.price} aria-invalid={errors.price ? true : undefined} aria-describedby={errors.price ? id("price-error") : undefined} />
        {errors.price && <p id={id("price-error")} className="error">{errors.price}</p>}
      </div>
      <div className="field">
        <label htmlFor={id("note")}>Заметка</label>
        <textarea id={id("note")} name="note" className="textarea" placeholder="Размер M, чёрные" maxLength={300} defaultValue={defaults.note} aria-invalid={errors.note ? true : undefined} aria-describedby={errors.note ? id("note-error") : undefined} />
        {errors.note && <p id={id("note-error")} className="error">{errors.note}</p>}
      </div>
      <label className="checkbox">
        <input type="checkbox" name="isMustHave" defaultChecked={defaults.isMustHave} /> Очень хочу
      </label>
    </>
  );
}
