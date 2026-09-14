import { describe, expect, test } from "vitest";
import {
  decideCancel,
  decideReserve,
  guestReservationView,
  ownerReservationView,
  type ItemReservationState,
  type Viewer,
} from "./reservations";

const OWNER = "owner-1";
const free: ItemReservationState = { ownerId: OWNER, active: null };
const reservedByAnon: ItemReservationState = {
  ownerId: OWNER,
  active: { guestUserId: null, guestToken: "tok-anna", guestName: "Аня" },
};
const reservedByUser: ItemReservationState = {
  ownerId: OWNER,
  active: { guestUserId: "user-2", guestToken: null, guestName: "Оля" },
};
const anon = (token: string): Viewer => ({ userId: null, guestToken: token });
const user = (id: string): Viewer => ({ userId: id, guestToken: null });

describe("decideReserve", () => {
  test("allows a guest to reserve a free item and trims the name", () => {
    expect(decideReserve(free, anon("tok-anna"), "  Аня ")).toEqual({ ok: true, guestName: "Аня" });
  });

  test("rejects the owner reserving their own item", () => {
    expect(decideReserve(free, user(OWNER), "Маша")).toEqual({ ok: false, reason: "OWNER_CANNOT_RESERVE" });
  });

  test("rejects when the item already has an active reservation", () => {
    expect(decideReserve(reservedByAnon, anon("tok-other"), "Петя")).toEqual({ ok: false, reason: "ALREADY_RESERVED" });
  });

  test("rejects a viewer without user id and guest token", () => {
    expect(decideReserve(free, { userId: null, guestToken: null }, "Аня")).toEqual({ ok: false, reason: "NO_IDENTITY" });
  });

  test("rejects an empty or too long name", () => {
    expect(decideReserve(free, anon("t"), "   ")).toEqual({ ok: false, reason: "INVALID_NAME" });
    expect(decideReserve(free, anon("t"), "я".repeat(41))).toEqual({ ok: false, reason: "INVALID_NAME" });
  });
});

describe("decideCancel", () => {
  test("lets the anonymous guest who reserved cancel by token", () => {
    expect(decideCancel(reservedByAnon, anon("tok-anna"))).toEqual({ ok: true });
  });

  test("lets the logged-in guest who reserved cancel", () => {
    expect(decideCancel(reservedByUser, user("user-2"))).toEqual({ ok: true });
  });

  test("rejects someone else cancelling", () => {
    expect(decideCancel(reservedByAnon, anon("tok-other"))).toEqual({ ok: false, reason: "NOT_YOUR_RESERVATION" });
    expect(decideCancel(reservedByUser, user(OWNER))).toEqual({ ok: false, reason: "NOT_YOUR_RESERVATION" });
  });

  test("rejects cancelling a free item", () => {
    expect(decideCancel(free, anon("tok-anna"))).toEqual({ ok: false, reason: "NOT_RESERVED" });
  });
});

describe("ownerReservationView", () => {
  test("shows only a reserved flag, never guest details", () => {
    const view = ownerReservationView(reservedByAnon, false);
    expect(view).toEqual({ reserved: true });
    expect(JSON.stringify(view)).not.toContain("Аня");
  });

  test("hides even the reserved flag in surprise mode", () => {
    expect(ownerReservationView(reservedByAnon, true)).toEqual({ reserved: false });
  });

  test("reports free items as not reserved", () => {
    expect(ownerReservationView(free, false)).toEqual({ reserved: false });
  });
});

describe("guestReservationView", () => {
  test("distinguishes free, mine and someone else's", () => {
    expect(guestReservationView(free, anon("tok-anna"))).toEqual({ status: "free" });
    expect(guestReservationView(reservedByAnon, anon("tok-anna"))).toEqual({ status: "reserved_by_me" });
    expect(guestReservationView(reservedByAnon, anon("tok-other"))).toEqual({ status: "reserved_by_other" });
    expect(guestReservationView(reservedByUser, user("user-2"))).toEqual({ status: "reserved_by_me" });
  });
});
