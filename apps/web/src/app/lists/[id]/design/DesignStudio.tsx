"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { Check, CreditCard, Palette } from "lucide-react";
import type { DesignAccess, WishlistTheme as Theme } from "@wishlist/db";
import { WishlistTheme } from "@/components/WishlistTheme";
import { checkDesignPaymentAction, checkoutDesignAction, selectThemeAction } from "./actions";

export function DesignStudio({ wishlistId, title, access, salesEnabled, testMode, offerUrl, preview, checkOnReturn = false }: {
  wishlistId: string; title: string; access: DesignAccess; salesEnabled: boolean; testMode: boolean; offerUrl: string | null; preview: ReactNode; checkOnReturn?: boolean;
}) {
  const [theme, setTheme] = useState<Theme>(access.children ? access.theme : "children");
  const [product, setProduct] = useState("children_invitation");
  const [checkout, buy, buying] = useActionState(checkoutDesignAction.bind(null, wishlistId), { message: "" });
  const [selection, select, saving] = useActionState(selectThemeAction.bind(null, wishlistId), { message: "" });
  useEffect(() => { setTheme(access.children ? access.theme : "children"); }, [wishlistId, access.children, access.theme]);
  useEffect(() => {
    if (checkOnReturn) void checkDesignPaymentAction(wishlistId).catch(() => {});
  }, [checkOnReturn, wishlistId]);
  return <section className="design-studio" aria-label="Оформление списка">
    <div>
      <form action={select}>
        <fieldset><legend>Расцветка</legend><div className="design-swatches">
          {([["journal", "Журнал", "journal"], ["children", "Голубой", "blue"], ["children-pink", "Розовый", "pink"]] as const).map(([value, label, color]) =>
            <label key={value}><input type="radio" name="theme" value={value} checked={theme === value} onChange={() => setTheme(value)} /><span className={`design-swatch design-swatch--${color}`} aria-hidden="true" />{label}</label>)}
        </div></fieldset>
        <button className="button button--ghost" disabled={saving || (theme !== "journal" && !access.children)}><Palette aria-hidden="true" />{saving ? "Сохраняем…" : "Применить"}</button>
        {selection.message && <p role="status">{selection.message}</p>}
      </form>
      {!access.invitation && <form action={buy} className="design-checkout">
        <fieldset><legend>{access.children ? "Приглашение" : "Детское оформление"}</legend>
          {!access.children && <label className="design-plan"><input type="radio" name="product" value="children" checked={product === "children"} onChange={() => setProduct("children")} /><span><strong>Оформление</strong><small>Голубая и розовая расцветки</small></span><strong className="design-price">149 ₽</strong></label>}
          <label className="design-plan"><input type="radio" name="product" value="children_invitation" checked={access.children || product === "children_invitation"} onChange={() => setProduct("children_invitation")} /><span><strong>{access.children ? "Добавить приглашение" : "Оформление + приглашение"}</strong><small>PNG для MAX, Telegram и ВК</small></span><strong className="design-price">{access.children ? "50 ₽" : "199 ₽"}</strong></label>
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
      {access.invitation && <p className="row"><Check size={18} aria-hidden="true" />Оформление и приглашение куплены</p>}
    </div>
    <div className="design-preview"><p className="design-preview__label">Предпросмотр</p><WishlistTheme theme={theme}><h2>{title}</h2>{preview}</WishlistTheme></div>
  </section>;
}
