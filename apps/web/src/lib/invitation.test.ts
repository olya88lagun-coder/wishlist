import { describe, expect, it } from "vitest";
import { formatInvitationDate, invitationAge, invitationDisplayText, invitationMessage, invitationSchema } from "./invitation";

const valid = { name: "Маша", date: "2028-02-29", time: "14:30" };

describe("invitationSchema", () => {
  it("trims fields and accepts omitted or empty optional fields", () => {
    expect(invitationSchema.parse({ ...valid, name: " Маша ", age: " 9 ", place: " Парк ", message: " Ждём! " }))
      .toEqual({ ...valid, color: "blue", age: "9", place: "Парк", message: "Ждём!" });
    expect(invitationSchema.safeParse(valid).success).toBe(true);
    expect(invitationSchema.safeParse({ ...valid, age: "", place: "", message: "" }).success).toBe(true);
  });

  it("defaults to blue and accepts pink without changing the invitation fields", () => {
    expect(invitationSchema.parse(valid).color).toBe("blue");
    expect(invitationSchema.parse({ ...valid, color: "pink" }).color).toBe("pink");
    expect(invitationSchema.safeParse({ ...valid, color: "red" }).success).toBe(false);
  });

  it.each([
    { name: " " }, { name: "я".repeat(41) }, { name: "Ма\nша" },
    { age: "0" }, { age: "01" }, { age: "100" }, { age: "1.5" }, { age: "-1" },
    { date: "2027-02-29" }, { date: "2028-02-30" }, { date: "2028-13-01" },
    { date: "0000-01-01" }, { date: "2028-2-01" }, { date: "2028-01-01T00:00:00Z" },
    { time: "24:00" }, { time: "12:60" }, { time: "9:00" },
    { place: "x".repeat(121) }, { place: "Парк\r\nДом" }, { message: "я".repeat(181) },
    { message: "Привет\u0000" }, { shareUrl: "https://evil.example" },
  ])("rejects invalid or untrusted input: %j", (patch) => {
    expect(invitationSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });

  it("accepts boundary lengths, both ages, midnight and bounded multiline message", () => {
    for (const age of ["1", "99"]) {
      expect(invitationSchema.safeParse({ name: "я".repeat(40), age, date: "2000-02-29", time: "00:00", place: "я".repeat(120), message: "я".repeat(180) }).success).toBe(true);
    }
    expect(invitationSchema.safeParse({ ...valid, message: "Приходи!\nБудем рады." }).success).toBe(true);
  });
});

it("builds clipboard text with the actual supplied share URL and optional details", () => {
  const input = invitationSchema.parse({ ...valid, age: "7", place: "Парк", message: "Ждём тебя!" });
  const text = invitationMessage(input, "https://my-wish-list.online/real-slug");
  expect(text).toContain("Маша · 7 лет");
  expect(text).toContain("29 февраля 2028 г., 14:30");
  expect(text).toContain("Парк\nЖдём тебя!");
  expect(text).toContain("Список подарков: https://my-wish-list.online/real-slug");
  expect(invitationMessage(invitationSchema.parse(valid), "https://example.com/list")).not.toContain("undefined");
});

it.each([["1", "1 год"], ["2", "2 года"], ["11", "11 лет"], ["21", "21 год"], ["24", "24 года"], ["99", "99 лет"]])("formats age %s", (age, expected) => {
  expect(invitationAge(age)).toBe(expected);
});

it("formats dates without a local timezone shift and tolerates unfinished preview input", () => {
  expect(formatInvitationDate("2028-01-01")).toBe("1 января 2028 г.");
  expect(formatInvitationDate("2028-02-30")).toBe("Дата праздника");
});

it("uses the same offline-safe text for preview and PNG", () => {
  expect(invitationDisplayText("Маша 🎉\nЖдём!  Парк №1")).toBe("Маша ? Ждём! Парк №1");
  expect(invitationDisplayText("你好")).toBe("??");
});
