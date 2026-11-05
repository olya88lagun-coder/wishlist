"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { trackEvent } from "@/lib/analytics";
import { drawSantaGameAction, issueRecoveryLinkAction, removeSantaParticipantAction } from "../actions";

export function DrawButton({ gameId }: { gameId: string }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div>
      <button type="button" className="button" disabled={pending} onClick={() => start(async () => {
        if (!window.confirm("После жеребьёвки вступить в игру будет нельзя. Провести?")) return;
        const result = await drawSantaGameAction(gameId);
        setMessage(result.ok ? null : result.message);
      })}>Провести жеребьёвку</button>
      {message && <p className="error" role="alert">{message}</p>}
    </div>
  );
}

export function ParticipantControls({ gameId, participantId, canRecover }: { gameId: string; participantId: string; canRecover: boolean }) {
  const [pending, start] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  return (
    <span>
      {" "}
      {canRecover && (
        <button type="button" className="link-button" disabled={pending} onClick={() => start(async () => setLink(await issueRecoveryLinkAction(gameId, participantId)))}>
          Ссылка для возврата
        </button>
      )}
      {" "}
      <button type="button" className="link-button" disabled={pending} onClick={() => start(async () => {
        if (window.confirm("Удалить участника из игры?")) await removeSantaParticipantAction(gameId, participantId);
      })}>Удалить</button>
      {link && <input className="input" readOnly value={link} aria-label="Одноразовая ссылка для возврата" />}
    </span>
  );
}

export function RecipientLink({ href }: { href: string }) {
  return <Link href={href} onClick={() => trackEvent("santa_recipient_opened")}>Открыть список получателя</Link>;
}
