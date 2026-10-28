"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Copy, Download, LoaderCircle, PartyPopper } from "lucide-react";
import { formatInvitationDate, invitationAge, invitationDisplayText, invitationMessage, invitationSchema, type InvitationInput } from "../lib/invitation";
import "./invitation.css";

type InvitationEditorProps = {
  wishlistId: string;
  title: string;
  eventDate: string | null;
  shareUrl: string;
  enabled: boolean;
};
type Field = Exclude<keyof InvitationInput, "color">;
const fields: { key: Field; label: string; type?: string; max?: number; required?: boolean }[] = [
  { key: "name", label: "Имя ребёнка", max: 40, required: true },
  { key: "age", label: "Возраст (необязательно)", max: 2 },
  { key: "date", label: "Дата праздника", type: "date", required: true },
  { key: "time", label: "Время", type: "time", required: true },
  { key: "place", label: "Место (необязательно)", max: 120 },
  { key: "message", label: "Сообщение (необязательно)", max: 180 },
];

export function InvitationEditor({ wishlistId, title, eventDate, shareUrl, enabled }: InvitationEditorProps) {
  const id = useId();
  const [draft, setDraft] = useState<InvitationInput>({ color: "blue", name: "", age: "", date: eventDate?.slice(0, 10) ?? "", time: "", place: "", message: "" });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyFallback, setCopyFallback] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const request = useRef<AbortController | null>(null);
  const objectUrls = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      request.current?.abort();
      for (const [url, timer] of urls) { clearTimeout(timer); URL.revokeObjectURL(url); }
      urls.clear();
    };
  }, []);

  useEffect(() => {
    request.current?.abort();
    request.current = null;
    setBusy(false);
  }, [wishlistId, enabled]);

  useEffect(() => {
    setDraft({ color: "blue", name: "", age: "", date: eventDate?.slice(0, 10) ?? "", time: "", place: "", message: "" });
    setErrors({}); setStatus(""); setCopyFallback("");
  }, [wishlistId, eventDate]);

  function validate(): InvitationInput | null {
    const result = invitationSchema.safeParse(draft);
    setStatus("");
    setFailed(false);
    if (result.success) { setErrors({}); return result.data; }
    const next: Partial<Record<Field, string>> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as Field;
      if (!next[key]) next[key] = issue.message;
    }
    setErrors(next);
    const first = fields.find(({ key }) => next[key]);
    if (first) formRef.current?.querySelector<HTMLInputElement>(`[name="${first.key}"]`)?.focus();
    return null;
  }

  async function download(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled || request.current) return;
    const input = validate();
    if (!input) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setStatus("Готовим PNG…");
    try {
      const response = await fetch(`/api/lists/${encodeURIComponent(wishlistId)}/invitation`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
        signal: controller.signal, cache: "no-store",
      });
      if (!response.ok) {
        const messages: Record<number, string> = {
          401: "Войдите в аккаунт заново.", 403: "Экспорт приглашения недоступен для этого списка.",
          400: "Проверьте поля приглашения.", 422: "Проверьте поля приглашения.", 429: "Слишком много запросов. Попробуйте чуть позже.",
        };
        throw new Error(messages[response.status] ?? "Не удалось создать PNG. Попробуйте ещё раз.");
      }
      if (response.headers.get("content-type")?.split(";")[0]?.trim() !== "image/png") throw new Error("Сервер не вернул PNG. Попробуйте ещё раз.");
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      if (!blob.size) throw new Error("Получен пустой файл. Попробуйте ещё раз.");
      const url = URL.createObjectURL(blob);
      const timer = setTimeout(() => { URL.revokeObjectURL(url); objectUrls.current.delete(url); }, 60_000);
      objectUrls.current.set(url, timer);
      const link = document.createElement("a");
      link.href = url;
      link.download = "priglashenie.png";
      document.body.append(link);
      link.click();
      link.remove();
      setStatus("PNG готов. Скачивание началось.");
    } catch (error) {
      if (controller.signal.aborted) return;
      setFailed(true);
      setStatus(error instanceof TypeError ? "Нет связи с сервером. Попробуйте ещё раз." : error instanceof Error ? error.message : "Не удалось скачать PNG.");
    } finally {
      if (request.current === controller) { request.current = null; setBusy(false); }
    }
  }

  async function copyMessage() {
    const input = validate();
    if (!input) return;
    const text = invitationMessage(input, shareUrl);
    setCopyBusy(true);
    try {
      await navigator.clipboard.writeText(text);
      setCopyFallback("");
      setStatus("Текст приглашения скопирован.");
    } catch {
      setCopyFallback(text);
      setStatus("Буфер обмена недоступен.");
    } finally { setCopyBusy(false); }
  }

  return (
    <section className="invitation-editor ym-hide-content ym-disable-keys" data-invitation-color={draft.color} aria-labelledby={`${id}-heading`}>
      <header className="invitation-editor__header">
        <PartyPopper size={28} aria-hidden="true" />
        <div><h2 id={`${id}-heading`}>Приглашение на праздник</h2><p>{title}</p></div>
      </header>
      <div className="invitation-editor__layout">
        <form ref={formRef} onSubmit={download} noValidate className="invitation-editor__form">
          <fieldset className="invitation-editor__colors" disabled={busy}>
            <legend>Цвет приглашения</legend>
            {([ ["blue", "Голубой"], ["pink", "Розовый"] ] as const).map(([color, label]) => (
              <label key={color} className="invitation-editor__swatch">
                <input type="radio" name={`${id}-color`} value={color} checked={draft.color === color}
                  onChange={() => { setDraft((old) => ({ ...old, color })); setStatus(""); }} />
                <span className={`invitation-editor__swatch-dot invitation-editor__swatch-dot--${color}`} aria-hidden="true" />{label}
              </label>
            ))}
          </fieldset>
          <fieldset disabled={busy}>
            <legend className="invitation-editor__sr">Детали приглашения</legend>
            <div className="invitation-editor__fields">
              {fields.map(({ key, label, type = "text", max, required }) => {
                const common = {
                  className: "ym-disable-keys",
                  id: `${id}-${key}`, name: key, value: draft[key] ?? "", maxLength: max, required,
                  "aria-invalid": Boolean(errors[key]), "aria-describedby": errors[key] ? `${id}-${key}-error` : undefined,
                  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                    setDraft((old) => ({ ...old, [key]: event.target.value }));
                    setErrors((old) => ({ ...old, [key]: undefined }));
                    setStatus(""); setCopyFallback("");
                  },
                };
                return <div key={key} className={`invitation-editor__field ${key === "place" || key === "message" || key === "name" ? "invitation-editor__wide" : ""}`}>
                  <label htmlFor={common.id}>{label}</label>
                  {key === "message" ? <textarea {...common} rows={3} /> : <input {...common} type={type} inputMode={key === "age" ? "numeric" : undefined} autoComplete="off" />}
                  {errors[key] && <span id={`${id}-${key}-error`} className="invitation-editor__error">{errors[key]}</span>}
                </div>;
              })}
            </div>
          </fieldset>
          {!enabled && <p className="invitation-editor__availability">Экспорт PNG недоступен</p>}
          <div className="invitation-editor__actions">
            <button type="submit" disabled={!enabled || busy}>{busy ? <LoaderCircle size={20} aria-hidden="true" /> : <Download size={20} aria-hidden="true" />}{busy ? "Готовим PNG…" : "Скачать PNG"}</button>
            <button type="button" className="invitation-editor__copy" onClick={copyMessage} disabled={busy || copyBusy}><Copy size={20} aria-hidden="true" />{copyBusy ? "Копируем…" : "Текст для MAX, Telegram, ВК"}</button>
          </div>
          <p role="status" aria-live="polite" className={failed ? "invitation-editor__error" : "invitation-editor__status"}>{status}</p>
          {copyFallback && <div className="invitation-editor__field"><label htmlFor={`${id}-copy`}>Текст приглашения</label><textarea id={`${id}-copy`} readOnly rows={7} value={copyFallback} onFocus={(event) => event.currentTarget.select()} /></div>}
        </form>
        <div className="invitation-editor__preview-wrap">
          <p className="invitation-editor__caption">Предпросмотр</p>
          <article className="invitation-editor__preview" aria-label="Предпросмотр приглашения">
            <div className="invitation-editor__decoration"><span>Будет весело!</span></div>
            <h3>Приглашаем на<br />день рождения!</h3>
            <p className="invitation-editor__name">{invitationDisplayText(draft.name.trim()) || "Имя ребёнка"}</p>
            {draft.age && <p className="invitation-editor__age">{invitationAge(draft.age)}</p>}
            <p>{formatInvitationDate(draft.date)}{draft.time && ` · ${draft.time}`}</p>
            {draft.place && <p>{invitationDisplayText(draft.place.trim())}</p>}
            <p className="invitation-editor__message">{invitationDisplayText(draft.message?.trim() || "Очень ждём тебя на празднике!")}</p>
            <footer><strong>Список подарков</strong><span>{shareUrl}</span></footer>
          </article>
        </div>
      </div>
    </section>
  );
}
