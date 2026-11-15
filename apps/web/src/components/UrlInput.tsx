"use client";

import type { ClipboardEvent, InputHTMLAttributes } from "react";

// Мобильное «Поделиться» из WB/Ozon даёт «Название\nhttps://…»: при вставке оставляем только ссылку
export function UrlInput(props: InputHTMLAttributes<HTMLInputElement>) {
  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    const url = event.clipboardData.getData("text").match(/https?:\/\/\S+/i)?.[0];
    if (!url) return;
    event.preventDefault();
    const input = event.currentTarget;
    input.setRangeText(url, input.selectionStart ?? 0, input.selectionEnd ?? 0, "end");
  }
  return <input type="url" inputMode="url" {...props} onPaste={onPaste} />;
}
