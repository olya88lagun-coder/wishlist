"use server";

import { signSession } from "@wishlist/core";
import {
  createAnonymousUser,
  createSantaGame,
  discardAnonymousUser,
  drawSantaGame,
  issueRecoveryToken,
  joinSantaGame,
  removeSantaParticipant,
  SANTA_NAME_MAX,
} from "@wishlist/db";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { recordCompletion } from "@/server/analytics-completion";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { SESSION_COOKIE, sessionCookieOptions } from "@/server/http";
import { enqueueNotify } from "@/server/queue";
import { editLimiter, santaJoinLimiter } from "@/server/rate-limit";
import { clientKey, readViewer, requireUser } from "@/server/viewer";
import { errorState, type FormState, formValues, LIMIT_MESSAGES } from "../lists/form-state";
import type { SantaJoinState } from "./join-state";

const field = (form: FormData, name: string) => String(form.get(name) ?? "");

const JOIN_ERRORS = {
  NOT_FOUND: "Игра не найдена. Проверьте ссылку у организатора.",
  CLOSED: "Жеребьёвка уже прошла, вступить нельзя.",
  FULL: "В игре уже максимум участников.",
  INVALID_NAME: `Напишите имя — до ${SANTA_NAME_MAX} символов.`,
} as const;

function joinError(message: string): SantaJoinState {
  return { status: "error", message, gameId: null, personalLink: null };
}

export async function createSantaGameAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (user.providers.length === 0) redirect("/login?returnTo=/santa/new");
  if (!editLimiter.allow(await clientKey({ userId: user.id, guestToken: null }))) return errorState({}, LIMIT_MESSAGES.rate, formValues(form));
  const created = await createSantaGame(getDb(), user.id, {
    title: field(form, "title"),
    budgetText: field(form, "budget"),
    exchangeDate: field(form, "exchangeDate"),
    organizerName: field(form, "name") || user.displayName,
  });
  if (!created.ok) {
    if (created.reason === "ANONYMOUS_ORGANIZER") redirect("/login?returnTo=/santa/new");
    const message = created.reason === "LIMIT" ? "Достигнут лимит игр." : "Проверьте название, бюджет и дату обмена.";
    return errorState({}, message, formValues(form));
  }
  await recordCompletion({ event: "santa_created", params: {} });
  redirect(`/santa/${created.gameId}`);
}

export async function joinSantaGameAction(code: string, _prev: SantaJoinState, form: FormData): Promise<SantaJoinState> {
  const { viewer, user } = await readViewer();
  if (!santaJoinLimiter.allow(await clientKey(viewer))) return joinError(LIMIT_MESSAGES.rate);
  const name = field(form, "name").trim();
  if (!name || name.length > SANTA_NAME_MAX) return joinError(JOIN_ERRORS.INVALID_NAME);

  const db = getDb();
  const userId = user?.id ?? (await createAnonymousUser(db, name)).userId;
  const joined = await joinSantaGame(db, code, userId, name);
  if (!joined.ok) {
    if (!user) await discardAnonymousUser(db, userId);
    return joinError(JOIN_ERRORS[joined.reason]);
  }
  if (!user) (await cookies()).set(SESSION_COOKIE, await signSession(userId, getEnv().SESSION_SECRET), sessionCookieOptions());
  if (!joined.alreadyJoined) await recordCompletion({ event: "santa_joined", params: { signed_in: Boolean(user && user.providers.length > 0) } });
  if (!joined.personalToken) redirect(`/santa/${joined.gameId}`);
  // Личную ссылку показываем один раз: в базе хранится только её хэш
  const personalLink = new URL(`/santa/me/${joined.personalToken}`, getEnv().APP_URL).toString();
  return { status: "success", message: null, gameId: joined.gameId, personalLink };
}

export async function drawSantaGameAction(gameId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireUser();
  const drawn = await drawSantaGame(getDb(), gameId, user.id);
  if (!drawn.ok) {
    const message = drawn.reason === "TOO_FEW" ? "Для жеребьёвки нужно минимум 3 участника." : drawn.reason === "ALREADY_DRAWN" ? "Жеребьёвка уже прошла." : "Жеребьёвку проводит организатор.";
    return { ok: false, message };
  }
  await enqueueNotify({ kind: "santa_drawn", gameId });
  await recordCompletion({ event: "santa_drawn", params: {} });
  revalidatePath(`/santa/${gameId}`);
  return { ok: true };
}

export async function removeSantaParticipantAction(gameId: string, participantId: string): Promise<boolean> {
  const user = await requireUser();
  const removed = await removeSantaParticipant(getDb(), gameId, user.id, participantId);
  if (removed) revalidatePath(`/santa/${gameId}`);
  return removed;
}

export async function issueRecoveryLinkAction(gameId: string, participantId: string): Promise<string | null> {
  const user = await requireUser();
  const token = await issueRecoveryToken(getDb(), gameId, user.id, participantId);
  return token ? new URL(`/santa/me/${token}`, getEnv().APP_URL).toString() : null;
}
