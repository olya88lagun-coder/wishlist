"use client";

import Link from "next/link";
import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { CopyLinkField } from "../../CopyLinkField";
import { joinSantaGameAction } from "../../actions";
import { initialSantaJoinState } from "../../join-state";

export function JoinSantaForm({ code, gameId, joined, defaultName }: { code: string; gameId: string; joined: boolean; defaultName: string }) {
  const [state, action] = useActionState(joinSantaGameAction.bind(null, code), initialSantaJoinState);
  if (state.status === "success" && state.personalLink) {
    return (
      <div className="santa-form">
        <p className="santa-kicker">Приглашение принято</p>
        <h2>Вы в игре!</h2>
        <div className="santa-callout">
          <h3>Сохраните личную ссылку</h3>
          <p>Она появится только сейчас. По ней вы сможете вернуться в игру с другого устройства.</p>
          <CopyLinkField label="Ваша личная ссылка" value={state.personalLink} />
        </div>
        <Link className="button button--block" href={`/santa/${state.gameId}`}>Перейти к игре</Link>
      </div>
    );
  }
  if (joined) {
    return (
      <div className="santa-form">
        <p className="santa-kicker">Приглашение принято</p>
        <h2>Вы уже в этой игре</h2>
        <Link className="button button--block" href={`/santa/${gameId}`}>Перейти к игре</Link>
      </div>
    );
  }
  return (
    <form action={action} className="santa-form" noValidate>
      <p className="santa-kicker">Приглашение для вас</p>
      <h2>Вступите в игру</h2>
      <p className="santa-note">Укажите имя, по которому друзья вас узнают. Для участия достаточно имени.</p>
      <div className="field">
        <label htmlFor="santa-join-name">Ваше имя</label>
        <input id="santa-join-name" name="name" className="input" maxLength={40} required defaultValue={defaultName} />
      </div>
      {state.message && <p className="error" role="alert">{state.message}</p>}
      <SubmitButton pendingText="Вступаем…">Вступить в игру</SubmitButton>
    </form>
  );
}
