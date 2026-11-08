import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";
import { loadOgFonts } from "../app/[slug]/og-render";
import { DedMorozLetterPaper } from "../components/DedMorozLetterPaper";
import { dedMorozLetterText, type DedMorozLetterInput } from "../lib/ded-moroz-letter";

const LANDSCAPE_URL = new URL("../../public/themes/ded-moroz-winter-post.png", import.meta.url);
const CAVEAT_URL = new URL("../../assets/fonts/Caveat-Bold.ttf", import.meta.url);

// A4 at 150 dpi.
export const LETTER_SIZE = { width: 1240, height: 1754 } as const;

export async function renderDedMorozLetter(input: DedMorozLetterInput): Promise<Response> {
  const letter = dedMorozLetterText(input);
  const [ogFonts, landscape, caveat] = await Promise.all([loadOgFonts(), readFile(LANDSCAPE_URL), readFile(CAVEAT_URL)]);
  const fonts = [...ogFonts, { name: "Caveat", data: caveat, weight: 700, style: "normal" } as const];
  return new ImageResponse(
    <DedMorozLetterPaper letter={letter} landscapeSrc={`data:image/png;base64,${landscape.toString("base64")}`} />,
    { ...LETTER_SIZE, fonts, headers: { "Cache-Control": "private, no-store", "Content-Disposition": 'attachment; filename="pismo-ot-deda-moroza.png"' } },
  );
}
