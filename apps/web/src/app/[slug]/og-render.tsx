import { readFile } from "node:fs/promises";
import type { ReactElement } from "react";
import type { OgModel } from "./og-model";

export const OG_SIZE = { width: 1200, height: 630 } as const;

// Палитра «Журнала» (globals.css): крем, графит, жёлтый стикер
const CREAM = "#F6F1E7";
const GRAPHITE = "#2C2C2A";
const YELLOW = "#FFE66D";
const MUTED = "#6F6B63";

export type OgFont = { name: string; data: Buffer; weight: 600; style: "normal" | "italic" };

// Пути статические: так сборщик Next кладёт шрифты рядом с кодом и они попадают в standalone-образ
const PLAYFAIR_URL = new URL("../../../assets/fonts/PlayfairDisplay-SemiBoldItalic.ttf", import.meta.url);
const MANROPE_URL = new URL("../../../assets/fonts/Manrope-SemiBold.ttf", import.meta.url);

export async function loadOgFonts(): Promise<OgFont[]> {
  const [playfair, manrope] = await Promise.all([readFile(PLAYFAIR_URL), readFile(MANROPE_URL)]);
  return [
    { name: "Playfair", data: playfair, weight: 600, style: "italic" },
    { name: "Manrope", data: manrope, weight: 600, style: "normal" },
  ];
}

// satori требует явный display: flex у каждого контейнера с несколькими детьми
export function ogImageElement(model: OgModel): ReactElement {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: CREAM,
        color: GRAPHITE,
        padding: "72px 80px",
        fontFamily: "Manrope",
      }}
    >
      <div style={{ display: "flex", fontSize: 30, letterSpacing: 6, textTransform: "uppercase", color: MUTED }}>{model.eyebrow}</div>
      <div style={{ display: "flex", fontFamily: "Playfair", fontStyle: "italic", fontSize: 92, lineHeight: 1.05 }}>{model.title}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ display: "flex", fontSize: 34 }}>{model.items}</div>
          {model.countdown !== null && (
            <div
              style={{
                display: "flex",
                background: YELLOW,
                borderRadius: 999,
                padding: "14px 28px",
                fontSize: 30,
                transform: "rotate(-2deg)",
              }}
            >
              {model.countdown}
            </div>
          )}
        </div>
        <div style={{ display: "flex", fontSize: 28, color: MUTED }}>my-wish-list.online</div>
      </div>
    </div>
  );
}
