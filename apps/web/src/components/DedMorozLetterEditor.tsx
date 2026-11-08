"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Download, LoaderCircle, Snowflake } from "lucide-react";
import { dedMorozLetterSchema, dedMorozLetterText, type DedMorozLetterInput } from "../lib/ded-moroz-letter";
import { printableText } from "../lib/invitation";
import { DedMorozLetterPaper } from "./DedMorozLetterPaper";
import "./invitation.css";

type Draft = { name: string; gender: "boy" | "girl"; age: string; achievements: [string, string, string]; gift: string; wish: string };
const empty: Draft = { name: "", gender: "boy", age: "", achievements: ["", "", ""], gift: "", wish: "" };

// Текст письма виден бесплатно, скачивание PNG — после покупки.
export function DedMorozLetterEditor({ wishlistId, enabled, giftHint }: { wishlistId: string; enabled: boolean; giftHint?: string }) {
  const id = useId();
  const [draft, setDraft] = useState<Draft>(empty);
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  const input: DedMorozLetterInput = { ...draft, achievements: [...draft.achievements], gift: draft.gift || undefined, wish: draft.wish || undefined };
  const parsed = dedMorozLetterSchema.safeParse(input);
  const preview = dedMorozLetterText(parsed.success ? parsed.data : { name: printableText(draft.name) || "Имя", gender: draft.gender, age: /^\d+$/.test(draft.age) && Number(draft.age) <= 17 && Number(draft.age) > 0 ? draft.age : "6" });
  const set = (patch: Partial<Draft>) => { setDraft((old) => ({ ...old, ...patch })); setStatus(""); setFailed(false); };

  async function download(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled || request.current) return;
    if (!parsed.success) { setFailed(true); setStatus(parsed.error.issues[0]?.message ?? "Проверьте поля письма."); return; }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setStatus("Готовим письмо…");
    try {
      const response = await fetch(`/api/lists/${encodeURIComponent(wishlistId)}/ded-moroz-letter`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data), signal: controller.signal, cache: "no-store",
      });
      if (!response.ok) {
        const messages: Record<number, string> = { 401: "Войдите в аккаунт заново.", 403: "Письмо недоступно для этого списка.", 400: "Проверьте поля письма.", 429: "Слишком много запросов. Попробуйте чуть позже." };
        throw new Error(messages[response.status] ?? "Не удалось создать письмо. Попробуйте ещё раз.");
      }
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "pismo-ot-deda-moroza.png";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setStatus("Письмо готово. Скачивание началось. Распечатайте его на листе A4.");
    } catch (error) {
      if (controller.signal.aborted) return;
      setFailed(true);
      setStatus(error instanceof TypeError ? "Нет связи с сервером. Попробуйте ещё раз." : error instanceof Error ? error.message : "Не удалось скачать письмо.");
    } finally {
      if (request.current === controller) { request.current = null; setBusy(false); }
    }
  }

  return (
    <section className="invitation-editor letter-editor ym-hide-content ym-disable-keys" aria-labelledby={`${id}-heading`}>
      <header className="invitation-editor__header">
        <Snowflake size={28} aria-hidden="true" />
        <div><h2 id={`${id}-heading`}>Письмо от Деда Мороза</h2><p>Именное письмо для печати на A4. Данные ребёнка не сохраняются.</p></div>
      </header>
      <div className="invitation-editor__layout">
        <form onSubmit={download} noValidate className="invitation-editor__form">
          <fieldset disabled={busy}>
            <legend className="invitation-editor__sr">Данные для письма</legend>
            <div className="invitation-editor__fields">
              <div className="invitation-editor__field invitation-editor__wide">
                <label htmlFor={`${id}-name`}>Имя ребёнка</label>
                <input id={`${id}-name`} className="ym-disable-keys" value={draft.name} maxLength={30} required autoComplete="off" onChange={(e) => set({ name: e.target.value })} />
              </div>
              <fieldset className="invitation-editor__colors">
                <legend>Кому письмо</legend>
                {([["boy", "Мальчику"], ["girl", "Девочке"]] as const).map(([value, label]) => (
                  <label key={value} className="invitation-editor__swatch">
                    <input type="radio" name={`${id}-gender`} value={value} checked={draft.gender === value} onChange={() => set({ gender: value })} />{label}
                  </label>
                ))}
              </fieldset>
              <div className="invitation-editor__field">
                <label htmlFor={`${id}-age`}>Возраст</label>
                <input id={`${id}-age`} className="ym-disable-keys" value={draft.age} maxLength={2} inputMode="numeric" required autoComplete="off" onChange={(e) => set({ age: e.target.value })} />
              </div>
              {draft.achievements.map((value, index) => (
                <div key={index} className="invitation-editor__field invitation-editor__wide">
                  <label htmlFor={`${id}-deed-${index}`}>{index === 0 ? `Чем ${draft.gender === "girl" ? "она" : "он"} порадовал${draft.gender === "girl" ? "а" : ""} в этом году` : `Ещё одно достижение (необязательно)`}</label>
                  <input id={`${id}-deed-${index}`} className="ym-disable-keys" value={value} maxLength={70} autoComplete="off"
                    placeholder={index === 0 ? (draft.gender === "girl" ? "научилась кататься на велосипеде" : "научился кататься на велосипеде") : undefined}
                    onChange={(e) => { const next = [...draft.achievements] as Draft["achievements"]; next[index] = e.target.value; set({ achievements: next }); }} />
                </div>
              ))}
              <div className="invitation-editor__field invitation-editor__wide">
                <label htmlFor={`${id}-gift`}>Главное желание из письма Деду Морозу (необязательно)</label>
                <input id={`${id}-gift`} className="ym-disable-keys" value={draft.gift} maxLength={60} autoComplete="off" placeholder={giftHint} onChange={(e) => set({ gift: e.target.value })} />
              </div>
              <div className="invitation-editor__field invitation-editor__wide">
                <label htmlFor={`${id}-wish`}>Напутствие от Деда Мороза (необязательно)</label>
                <textarea id={`${id}-wish`} className="ym-disable-keys" rows={3} value={draft.wish} maxLength={160} onChange={(e) => set({ wish: e.target.value })} />
              </div>
            </div>
          </fieldset>
          {!enabled && <p className="invitation-editor__availability">Текст письма можно посмотреть бесплатно. Скачать письмо можно после покупки пакета «Новогоднее оформление + письмо».</p>}
          <div className="invitation-editor__actions">
            <button type="submit" disabled={!enabled || busy}>{busy ? <LoaderCircle size={20} aria-hidden="true" /> : <Download size={20} aria-hidden="true" />}{busy ? "Готовим письмо…" : "Скачать письмо A4"}</button>
          </div>
          <p role="status" aria-live="polite" className={failed ? "invitation-editor__error" : "invitation-editor__status"}>{status}</p>
        </form>
        <div className="invitation-editor__preview-wrap">
          <p className="invitation-editor__caption">Предпросмотр письма</p>
          <article className="letter-editor__paper" aria-label="Предпросмотр письма">
            <DedMorozLetterPaper letter={draft.name.trim() ? preview : { ...preview, initial: "" }} preview locked={!enabled} />
          </article>
        </div>
      </div>
    </section>
  );
}
