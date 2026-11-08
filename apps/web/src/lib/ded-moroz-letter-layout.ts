import advances from "./ded-moroz-letter-advances.json";

// Glyph advances from the bundled fonts, in thousandths of an em.
// A narrower measure leaves room for differences in how the renderers wrap text.
const textWidth = 1010;
const textHeight = 930;
const headingLineHeight = 1.08;

function wrappedLines(text: string, fontSize: number, widths: Readonly<Record<string, number>>): number {
  const measure = textWidth * 1000 / fontSize;
  const space = widths[" "] ?? 250;
  const advance = (character: string) => widths[character] ?? 1100;
  let lines = 1;
  let width = 0;

  for (const word of text.split(" ")) {
    const characters = [...word];
    const wordWidth = characters.reduce((total, character) => total + advance(character), 0);
    if (width && width + space + wordWidth > measure) {
      lines++;
      width = 0;
    }
    if (width) width += space;
    for (const character of characters) {
      const characterWidth = advance(character);
      if (width + characterWidth > measure) {
        lines++;
        width = 0;
      }
      width += characterWidth;
    }
  }

  return lines;
}

export function dedMorozLetterLayout(greeting: string, paragraphs: string[]) {
  let heading = 64;
  while (heading > 40 && wrappedLines(greeting, heading, advances.playfair) > 2) heading--;
  const headingLines = wrappedLines(greeting, heading, advances.playfair);
  const splitHeading = headingLines > 2;
  const headingHeight = Math.min(headingLines, 2) * heading * headingLineHeight;

  const fits = (font: number, line: number, gap: number) => {
    const lines = paragraphs.reduce((total, paragraph) => total + wrappedLines(paragraph, font, advances.caveat), 0);
    return headingHeight + lines * font * line + paragraphs.length * gap <= textHeight;
  };

  for (let font = 55; font >= 36; font--) {
    const gap = Math.round(font / 2.8);
    if (fits(font, 1.23, gap)) return { heading, splitHeading, font, line: 1.23, gap, sectionGap: 25 };
  }

  return { heading, splitHeading, font: 36, line: 1.10, gap: 8, sectionGap: 10 };
}

