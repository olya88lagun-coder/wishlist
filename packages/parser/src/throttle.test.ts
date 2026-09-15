import { expect, test } from "vitest";
import { createHostThrottle } from "./throttle";

// Время стоит на месте: так видно, на сколько каждый вызов откладывается относительно одного момента
function fakeClock() {
  const sleeps: number[] = [];
  return {
    sleeps,
    clock: {
      now: () => 1_000_000,
      sleep: async (ms: number) => {
        sleeps.push(ms);
      },
    },
  };
}

test("spaces requests to the same host and lets other hosts through", async () => {
  const { clock, sleeps } = fakeClock();
  const waitTurn = createHostThrottle(2000, clock);

  await waitTurn("https://www.wildberries.ru/catalog/1/detail.aspx");
  await waitTurn("https://goldapple.ru/1");
  await waitTurn("https://www.wildberries.ru/catalog/2/detail.aspx");

  expect(sleeps).toEqual([2000]);
});

test("concurrent callers for one host queue up one interval apart", async () => {
  const { clock, sleeps } = fakeClock();
  const waitTurn = createHostThrottle(2000, clock);

  await Promise.all([waitTurn("https://a.ru/1"), waitTurn("https://a.ru/2"), waitTurn("https://a.ru/3")]);

  expect(sleeps).toEqual([2000, 4000]);
});
