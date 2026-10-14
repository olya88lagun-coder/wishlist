import { ARTICLES } from "@/content/articles";

export const dynamic = "force-static";

// Краткое описание сайта для языковых моделей. Приватные и служебные адреса сюда не попадают.
export function GET() {
  const base = (process.env.APP_URL ?? "https://my-wish-list.online").replace(/\/$/, "");
  const lines = [
    "# MyWishList",
    "",
    "> Сервис списков желаний: добавьте подарки из магазинов, поделитесь одной ссылкой, друзья бронируют подарок без повторов. На сайте есть подборки идей подарков и статьи.",
    "",
    "## Подборки подарков",
    `- [Идеи подарков и AI-подбор](${base}/gifts): подбор по получателю, поводу и бюджету`,
    `- [Подарки детям по возрасту](${base}/gifts/for-children): от года до семи лет`,
    `- [Подарки до 3 000 ₽](${base}/gifts/under-3000)`,
    "",
    "## Статьи",
    ...ARTICLES.map((article) => `- [${article.title}](${base}/articles/${article.slug}): ${article.description}`),
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
