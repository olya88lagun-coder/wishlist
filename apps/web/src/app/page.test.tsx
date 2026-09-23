import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

const { readViewer } = vi.hoisted(() => ({
  readViewer: vi.fn(),
}));

vi.mock("@/server/viewer", () => ({
  readViewer,
}));

vi.mock("@/server/env", () => ({
  getEnv: () => ({
    APP_URL: "https://my-wish-list.online",
    TELEGRAM_BOT_USERNAME: "my_wish_list_bot",
  }),
}));

import Home from "./page";

describe("home page navigation", () => {
  test("renders the public home page for signed-in users instead of redirecting to lists", async () => {
    readViewer.mockResolvedValue({ user: { id: "user-1", name: "Ольга" } });

    const html = renderToStaticMarkup(await Home());

    expect(html).toContain("Подарки, которые");
    expect(html).toContain("Открыть мои списки");
    expect(html).toContain('href="/lists"');
    expect(html).toContain('href="/articles"');
  });
});
