"use client";

import Link from "next/link";
import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { joinSantaGameAction } from "../../actions";
import { initialSantaJoinState } from "../../join-state";

export function JoinSantaForm({ code, gameId, joined, defaultName }: { code: string; gameId: string; joined: boolean; defaultName: string }) {
  const [state, action] = useActionState(joinSantaGameAction.bind(null, code), initialSantaJoinState);
  if (state.status === "success" && state.personalLink) {
    return (
      <section className="stack" aria-label="Вы в игре">
        <p>Вы в игре! Сохраните личную ссылку: по ней вы вернётесь в игру с другого устройства. Мы покажем её только сейчас.</p>
        <div className="field">
          <label htmlFor="santa-personal-link">Ваша личная ссылка</label>
          <input id="santa-personal-link" className="input" readOnly value={state.personalLink} onFocus={(event) => event.currentTarget.select()} />
        </div>
        <Link className="button" href={`/santa/${state.gameId}`}>Перейти к игре</Link>
      </section>
    );
  }
  if (joined) {
    return (
      <section aria-label="Вы в игре">
        <p>Вы уже в этой игре.</p>
        <Link className="button" href={`/santa/${gameId}`}>Перейти к игре</Link>
      </section>
    );
  }
  return (
    <form action={action} className="stack" noValidate>
      <div className="field">
        <label htmlFor="santa-join-name">Ваше имя</label>
        <input id="santa-join-name" name="name" className="input" maxLength={40} required defaultValue={defaultName} />
      </div>
      {state.message && <p className="error" role="alert">{state.message}</p>}
      <SubmitButton pendingText="Вступаем…">Вступить в игру</SubmitButton>
    </form>
  );
}
