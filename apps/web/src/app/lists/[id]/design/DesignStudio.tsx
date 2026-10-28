"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { Check, CreditCard, Palette } from "lucide-react";
import type { DesignAccess, WishlistTheme as Theme } from "@wishlist/db";
import { WishlistTheme } from "@/components/WishlistTheme";
import { checkDesignPaymentAction, checkoutDesignAction, selectThemeAction } from "./actions";

export function DesignStudio({ wishlistId, title, access, salesEnabled, testMode, offerUrl, preview, invitationEditor, defaultTheme = "children", checkOnReturn = false }: {
  wishlistId: string; title: string; access: DesignAccess; salesEnabled: boolean; testMode: boolean; offerUrl: string | null; preview: ReactNode; invitationEditor?: ReactNode; defaultTheme?: Theme; checkOnReturn?: boolean;
}) {
  const [theme, setTheme] = useState<Theme>(access.children || access.newYear ? access.theme : defaultTheme);
  const [product, setProduct] = useState("children_invitation");
  const [checkout, buy, buying] = useActionState(checkoutDesignAction.bind(null, wishlistId), { message: "" });
  const [selection, select, saving] = useActionState(selectThemeAction.bind(null, wishlistId), { message: "" });
  useEffect(() => { setTheme(access.children || access.newYear ? access.theme : defaultTheme); }, [wishlistId, access.children, access.newYear, access.theme, defaultTheme]);
  useEffect(() => {
    if (checkOnReturn) void checkDesignPaymentAction(wishlistId).catch(() => {});
  }, [checkOnReturn, wishlistId]);
  const holiday = theme === "new-year";
  const child = theme === "children" || theme === "children-pink";
  const purchased = holiday ? access.newYear : child ? access.children : true;
  return <><section className="design-studio" aria-label="Оформление списка">
    <div>
      <form action={select}>
        <fieldset><legend>Тема и цвет</legend><div className="design-swatches">
          {([["journal", "Журнал", "journal"], ["children", "Голубой", "blue"], ["children-pink", "Розовый", "pink"], ["new-year", "Новый год", "new-year"]] as const).map(([value, label, color]) =>
            <label key={value}><input type="radio" name="theme" value={value} checked={theme === value} onChange={() => setTheme(value)} /><span className={`design-swatch design-swatch--${color}`} aria-hidden="true" />{label}</label>)}
        </div></fieldset>
        <button className="button button--ghost" disabled={saving || !purchased}><Palette aria-hidden="true" />{saving ? "Сохраняем…" : "Применить"}</button>
        {selection.message && <p role="status">{selection.message}</p>}
      </form>
      {((holiday && !access.newYear) || (child && !access.invitation)) && <form action={buy} className="design-checkout">
        <fieldset><legend>{holiday ? "Новогоднее оформление" : access.children ? "Приглашение" : "Детское оформление"}</legend>
          {holiday ? <label className="design-plan"><input type="radio" name="product" value="new_year" checked readOnly /><span><strong>Новый год</strong></span><strong className="design-price">149 ₽</strong></label> : <>
            {!access.children && <label className="design-plan"><input type="radio" name="product" value="children" checked={product === "children"} onChange={() => setProduct("children")} /><span><strong>Оформление</strong><small>Голубая и розовая расцветки</small></span><strong className="design-price">149 ₽</strong></label>}
            <label className="design-plan"><input type="radio" name="product" value="children_invitation" checked={access.children || product === "children_invitation"} onChange={() => setProduct("children_invitation")} /><span><strong>{access.children ? "Добавить приглашение" : "Оформление + приглашение"}</strong><small>PNG для MAX, Telegram и ВК</small></span><strong className="design-price">{access.children ? "50 ₽" : "199 ₽"}</strong></label>
          </>}
        </fieldset>
        <p className="muted">Разовая покупка для этого списка. Без подписки.</p>
        {salesEnabled ? <>
          {testMode && <p className="design-status">Тестовая оплата. Платные функции не активируются.</p>}
          <div className="field ym-hide-content"><label htmlFor="design-email">Email для чека</label><input id="design-email" name="email" type="email" required maxLength={254} autoComplete="email" className="input ym-disable-keys" /></div>
          <label className="checkbox"><input type="checkbox" name="consent" required /><span>Принимаю <a href={offerUrl!} target="_blank" rel="noopener noreferrer">условия покупки</a></span></label>
          <button className="button" disabled={buying}><CreditCard aria-hidden="true" />{buying ? "Переходим к оплате…" : "Перейти к оплате"}</button>
        </> : <button className="button" disabled>Оплата пока недоступна</button>}
        {checkout.message && <p className="error" role="alert">{checkout.message}</p>}
      </form>}
      {holiday && access.newYear && <p className="row"><Check size={18} aria-hidden="true" />Новогоднее оформление куплено</p>}
      {child && access.invitation && <p className="row"><Check size={18} aria-hidden="true" />Оформление и приглашение куплены</p>}
    </div>
    <div className="design-preview"><p className="design-preview__label">Предпросмотр</p><WishlistTheme theme={theme}><h2>{title}</h2>{preview}</WishlistTheme></div>
  </section>{child && invitationEditor}</>;
}
