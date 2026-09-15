"use client";

import { cancelAction } from "./actions";

export function CancelReservationButton({ slug, itemId }: { slug: string; itemId: string }) {
  return (
    <form
      action={cancelAction.bind(null, slug, itemId)}
      onSubmit={(event) => { if (!window.confirm("Снять бронь? Подарок снова станет свободным.")) event.preventDefault(); }}
    >
      <button type="submit" className="link-button">Снять бронь</button>
    </form>
  );
}
