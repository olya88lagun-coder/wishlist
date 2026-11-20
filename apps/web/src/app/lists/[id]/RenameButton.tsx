"use client";

// Открывает свёрнутые «Настройки списка» и ставит курсор в поле «Название»
export function RenameButton() {
  function open() {
    const input = document.getElementById("list-title") as HTMLInputElement | null;
    const details = input?.closest("details");
    if (!input || !details) return;
    details.open = true;
    input.scrollIntoView({ block: "center" });
    input.focus();
    input.select();
  }
  return <button type="button" className="button button--ghost button--small" onClick={open}>Переименовать</button>;
}
