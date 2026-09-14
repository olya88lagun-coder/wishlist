export const GUEST_NAME_MAX_LENGTH = 40;

export type Viewer = { userId: string | null; guestToken: string | null };

export type ActiveReservation = {
  guestUserId: string | null;
  guestToken: string | null;
  guestName: string;
};

export type ItemReservationState = { ownerId: string; active: ActiveReservation | null };

export type ReserveDecision =
  | { ok: true; guestName: string }
  | { ok: false; reason: "OWNER_CANNOT_RESERVE" | "ALREADY_RESERVED" | "NO_IDENTITY" | "INVALID_NAME" };

export type CancelDecision = { ok: true } | { ok: false; reason: "NOT_RESERVED" | "NOT_YOUR_RESERVATION" };

function isReservedBy(active: ActiveReservation, viewer: Viewer): boolean {
  if (viewer.userId !== null && active.guestUserId === viewer.userId) return true;
  return viewer.guestToken !== null && active.guestToken === viewer.guestToken;
}

export function decideReserve(state: ItemReservationState, viewer: Viewer, rawGuestName: string): ReserveDecision {
  if (viewer.userId === null && viewer.guestToken === null) return { ok: false, reason: "NO_IDENTITY" };
  if (viewer.userId === state.ownerId) return { ok: false, reason: "OWNER_CANNOT_RESERVE" };
  if (state.active !== null) return { ok: false, reason: "ALREADY_RESERVED" };
  const guestName = rawGuestName.trim();
  if (guestName.length === 0 || guestName.length > GUEST_NAME_MAX_LENGTH) {
    return { ok: false, reason: "INVALID_NAME" };
  }
  return { ok: true, guestName };
}

export function decideCancel(state: ItemReservationState, viewer: Viewer): CancelDecision {
  if (state.active === null) return { ok: false, reason: "NOT_RESERVED" };
  if (!isReservedBy(state.active, viewer)) return { ok: false, reason: "NOT_YOUR_RESERVATION" };
  return { ok: true };
}

export function ownerReservationView(state: ItemReservationState, surpriseMode: boolean): { reserved: boolean } {
  return { reserved: !surpriseMode && state.active !== null };
}

export function guestReservationView(
  state: ItemReservationState,
  viewer: Viewer,
): { status: "free" | "reserved_by_me" | "reserved_by_other" } {
  if (state.active === null) return { status: "free" };
  return { status: isReservedBy(state.active, viewer) ? "reserved_by_me" : "reserved_by_other" };
}
