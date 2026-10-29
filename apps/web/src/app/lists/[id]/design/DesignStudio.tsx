"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { EXTRA_DESIGNS } from "@wishlist/core";
import { Check, CreditCard, Palette } from "lucide-react";
import type { DesignAccess, WishlistTheme as Theme } from "@wishlist/db";
import { WishlistTheme } from "@/components/WishlistTheme";
import { CelebrationHeading } from "@/components/CelebrationHeading";
import { checkDesignPaymentAction, checkoutDesignAction, selectThemeAction } from "./actions";
import { isUnsavedSelection } from "./design-state";

export function DesignStudio({ wishlistId, title, eventDate, access, salesEnabled, testMode, offerUrl, receiptByProvider = false, publicHref, preview, invitationEditor, defaultTheme = "children", checkOnReturn = false }: {
  wishlistId: string; title: string; eventDate?: string | null; access: DesignAccess; salesEnabled: boolean; testMode: boolean; offerUrl: string | null; receiptByProvider?: boolean; publicHref?: string; preview: ReactNode; invitationEditor?: ReactNode; defaultTheme?: Theme; checkOnReturn?: boolean;
}) {
  const [theme, setTheme] = useState<Theme>(access.children || access.newYear || access.celebration || access.additionalThemes?.length ? access.theme : defaultTheme);
  const [product, setProduct] = useState("children_invitation");
  const [checkout, buy, buying] = useActionState(checkoutDesignAction.bind(null, wishlistId), { message: "" });
  const [selection, select, saving] = useActionState(selectThemeAction.bind(null, wishlistId), { message: "" });
  useEffect(() => { setTheme(access.children || access.newYear || access.celebration || access.additionalThemes?.length ? access.theme : defaultTheme); }, [wishlistId, access.children, access.newYear, access.celebration, access.additionalThemes?.length, access.theme, defaultTheme]);
  useEffect(() => {
    if (checkOnReturn) void checkDesignPaymentAction(wishlistId).catch(() => {});
  }, [checkOnReturn, wishlistId]);
  const extra = EXTRA_DESIGNS.find((design) => design.id === theme);
  const celebration = theme === "celebration";
  const holiday = theme === "new-year";
  const child = theme === "children" || theme === "children-pink";
  const purchased = extra ? Boolean(access.additionalThemes?.includes(extra.id)) : celebration ? access.celebration : holiday ? access.newYear : child ? access.children : true;
  const unsaved = isUnsavedSelection(theme, access.theme, purchased);
  return <><section className="design-studio" aria-label="Оформление списка">
    <div>
      <form action={select}>
        <fieldset><legend>Тема и цвет</legend><div className="design-swatches">
          {([["journal", "Журнал", "journal"], ["celebration", "Праздник", "celebration"], ["children", "Голубой", "blue"], ["children-pink", "Розовый", "pink"], ["new-year", "Новый год", "new-year"]] as const).map(([value, label, color]) =>
            <label key={value}><input type="radio" name="theme" value={value} checked={theme === value} onChange={() => setTheme(value)} /><span className={`design-swatch design-swatch--${color}`} aria-hidden="true" />{label}</label>)}
          {EXTRA_DESIGNS.map((design) => <label key={design.id}><input type="radio" name="theme" value={design.id} checked={theme === design.id} onChange={() => setTheme(design.id)} /><span className="design-swatch" style={{ background: design.color }} aria-hidden="true" />{design.label}</label>)}
        </div></fieldset>
        {unsaved && <p className="design-status" role="status">Это пока только предпросмотр. Нажмите «Применить», чтобы список стал таким.</p>}
        <button className={unsaved ? "button" : "button button--ghost"} disabled={saving || !purchased}><Palette aria-hidden="true" />{saving ? "Сохраняем…" : "Применить"}</button>
        {selection.message && <p role="status">{selection.message}</p>}
        {publicHref && !unsaved && <p><a href={publicHref} target="_blank" rel="noopener noreferrer">Посмотреть, как список видят гости</a></p>}
      </form>
      {((extra && !purchased) || (celebration && !access.celebration) || (holiday && !access.newYear) || (child && !access.invitation)) && <form action={buy} className="design-checkout">
        <fieldset><legend>{extra ? extra.label : celebration ? "Праздник" : holiday ? "Новогоднее оформление" : access.children ? "Приглашение" : "Детское оформление"}</legend>
          {extra ? <label className="design-plan"><input type="radio" name="product" value={extra.id} checked readOnly /><span><strong>{extra.label}</strong><small>{extra.description}. Обложка и фон всей страницы. Без приглашения.</small></span><strong className="design-price">149 ₽</strong></label> : celebration ? <label className="design-plan"><input type="radio" name="product" value="celebration" checked readOnly /><span><strong>Праздник</strong><small>Золотое конфетти и праздничный фон. Для любого возраста.</small></span><strong className="design-price">149 ₽</strong></label> : holiday ? <label className="design-plan"><input type="radio" name="product" value="new_year" checked readOnly /><span><strong>Новый год</strong></span><strong className="design-price">149 ₽</strong></label> : <>
            {!access.children && <label className="design-plan"><input type="radio" name="product" value="children" checked={product === "children"} onChange={() => setProduct("children")} /><span><strong>Оформление</strong><small>Голубая и розовая расцветки</small></span><strong className="design-price">149 ₽</strong></label>}
            <label className="design-plan"><input type="radio" name="product" value="children_invitation" checked={access.children || product === "children_invitation"} onChange={() => setProduct("children_invitation")} /><span><strong>{access.children ? "Добавить приглашение" : "Оформление + приглашение"}</strong><small>PNG для MAX, Telegram и ВК</small></span><strong className="design-price">{access.children ? "50 ₽" : "199 ₽"}</strong></label>
          </>}
        </fieldset>
        <p className="muted">Разовая покупка для этого списка. Без подписки.</p>
        {salesEnabled ? <>
          {testMode && <p className="design-status">Тестовая оплата. Платные функции не активируются.</p>}
          <div className="field ym-hide-content"><label htmlFor="design-email">{receiptByProvider ? "Email для чека" : "Email для связи по заказу"}</label><input id="design-email" name="email" type="email" required maxLength={254} autoComplete="email" className="input ym-disable-keys" />
            {!receiptByProvider && <p className="muted">Чек самозанятого из «Мой налог» оформляется после оплаты.</p>}</div>
          <label className="checkbox"><input type="checkbox" name="consent" required /><span>Принимаю <a href={offerUrl!} target="_blank" rel="noopener noreferrer">условия покупки</a></span></label>
          <button className="button" disabled={buying}><CreditCard aria-hidden="true" />{buying ? "Переходим к оплате…" : "Перейти к оплате"}</button>
        </> : <button className="button" disabled>Оплата пока недоступна</button>}
        {checkout.message && <p className="error" role="alert">{checkout.message}</p>}
      </form>}
      {extra && purchased && <p className="row"><Check size={18} aria-hidden="true" />Оформление «{extra.label}» куплено</p>}
      {celebration && access.celebration && <p className="row"><Check size={18} aria-hidden="true" />Оформление «Праздник» куплено</p>}
      {holiday && access.newYear && <p className="row"><Check size={18} aria-hidden="true" />Новогоднее оформление куплено</p>}
      {child && access.invitation && <p className="row"><Check size={18} aria-hidden="true" />Оформление и приглашение куплены</p>}
    </div>
    <div className="design-preview"><p className="design-preview__label">Предпросмотр</p><WishlistTheme theme={theme}>{theme !== "journal" ? <CelebrationHeading theme={theme} title={title} eventDate={eventDate} preview /> : <h2>{title}</h2>}{preview}</WishlistTheme></div>
  </section>{child && invitationEditor}</>;
}
