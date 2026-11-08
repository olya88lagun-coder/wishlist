import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { dedMorozLetterText } from "../lib/ded-moroz-letter";
import { DedMorozLetterEditor } from "./DedMorozLetterEditor";
import { DedMorozLetterPaper } from "./DedMorozLetterPaper";

test("shows the free text preview and locks the download until the letter is bought", () => {
  const locked = renderToStaticMarkup(<DedMorozLetterEditor wishlistId="list-1" enabled={false} giftHint="Самокат" />);
  expect(locked).toContain("Предпросмотр письма");
  expect(locked).toContain('class="letter-editor__watermark" aria-hidden="true"');
  expect(locked.match(/ОБРАЗЕЦ · my-wish-list\.online/g)?.length).toBeGreaterThan(1);
  expect(locked).toContain("Здравствуй, дорогой Имя!");
  expect(locked).toContain("placeholder=\"Самокат\"");
  expect(locked).toMatch(/<button type="submit" disabled="">/);
  const open = renderToStaticMarkup(<DedMorozLetterEditor wishlistId="list-1" enabled />);
  expect(open).not.toContain("после покупки");
  expect(open).not.toContain("letter-editor__watermark");
  expect(open).not.toContain("ОБРАЗЕЦ");
  expect(open).toMatch(/<button type="submit">/);
});

test("the preview seal uses the child's initial and falls back to a snowflake", () => {
  const base = { gender: "boy", age: "4" } as const;
  const render = (name: string) => renderToStaticMarkup(<DedMorozLetterPaper letter={dedMorozLetterText({ ...base, name })} preview />);
  const named = render("Ёжик");
  expect(named).toContain(">Ё</div>");
  expect(named).not.toContain("M50 29v42");
  // Имя без буквы в начале (эмодзи схема выбрасывает): печать со снежинкой
  expect(render("№ 7")).toContain("M50 29v42");
  expect(renderToStaticMarkup(<DedMorozLetterEditor wishlistId="list-1" enabled={false} />)).toContain("Имя");
});
