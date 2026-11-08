import type { DedMorozLetter } from "../lib/ded-moroz-letter";
import { invitationDisplayText } from "../lib/invitation";
import { dedMorozLetterLayout } from "../lib/ded-moroz-letter-layout";
import { WinterPostCorner, WinterPostFlourish, WinterPostStamp } from "./DedMorozLetterArt";

const paper = "#fff9ed";
const ink = "#34251e";
const gold = "#ab8246";
const green = "#375449";
const burgundy = "#852f42";

function SnowSeal({ size, initial, fontSize, serif }: {
  size: number | string;
  initial: string;
  fontSize: number | string;
  serif: string;
}) {
  return (
    <div aria-hidden="true" style={{ display: "flex", position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={100} height={100} style={{ width: size, height: size }} viewBox="0 0 100 100">
        <path d="M50 3c9 0 15 6 23 8 12 3 15 9 18 20 2 8 7 12 6 20 0 9-5 14-7 22-3 10-9 15-20 18-8 2-12 6-20 6-9 0-15-5-23-7-10-3-15-9-18-20-2-8-6-12-6-20s5-15 7-23c3-11 9-15 20-18 8-2 12-6 20-6Z" fill={burgundy} />
        <circle cx="50" cy="50" r="36" fill="none" stroke="#e8bc99" strokeWidth="1.5" />
        <circle cx="50" cy="50" r="31" fill="none" stroke="#e8bc99" strokeWidth="1" strokeDasharray="1 3" />
        {!initial && <path d="M50 29v42m-18-31 36 20M32 60l36-20M43 34l7 7 7-7m-14 32 7-7 7 7M34 47l9-2-2-9m25 17-9 2 2 9m-25-11 9 2-2 9m25-17-9-2 2-9" fill="none" stroke="#fff1d8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
      {initial && (
        <div style={{
          display: "flex", position: "absolute", top: 0, right: 0, bottom: 0, left: 0,
          justifyContent: "center", alignItems: "center", fontFamily: serif, fontStyle: "italic",
          fontSize, lineHeight: 1, color: "#fff1d8",
        }}>
          {initial}
        </div>
      )}
    </div>
  );
}



function SampleWatermark() {
  return (
    <div className="letter-editor__watermark" aria-hidden="true">
      <div className="letter-editor__watermark-grid">
        {Array.from({ length: 12 }, (_, row) => (
          <div key={row}>
            {Array.from({ length: 4 }, (_, column) => <span key={column}>ОБРАЗЕЦ · my-wish-list.online</span>)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DedMorozLetterPaper({ letter, preview = false, locked = false, landscapeSrc = "/themes/ded-moroz-winter-post.png" }: {
  letter: DedMorozLetter;
  preview?: boolean;
  locked?: boolean;
  landscapeSrc?: string;
}) {
  const size = (px: number, minimum = 0) => {
    if (!preview) return px;
    const relative = `${(px / 12.4).toFixed(3)}cqw`;
    return minimum ? `max(${minimum}px, ${relative})` : relative;
  };

  const greeting = invitationDisplayText(letter.greeting);
  const paragraphs = letter.paragraphs.map(invitationDisplayText);
  const layout = dedMorozLetterLayout(greeting, paragraphs);

  const serif = preview ? "var(--font-playfair), Georgia, serif" : "Playfair";
  const inset = size(43);
  const frame = { display: "flex", position: "absolute", top: inset, right: inset, bottom: inset, left: inset, border: `2px solid ${gold}`, pointerEvents: "none" } as const;

  return (
    <div style={{
      display: "flex", position: "relative", flexDirection: "column", boxSizing: "border-box",
      width: "100%", ...(preview ? { minHeight: size(1754) } : { height: "100%" }),
      paddingTop: size(75), paddingBottom: size(76), paddingLeft: size(104), paddingRight: size(104),
      gap: size(layout.sectionGap, 9), background: paper, color: ink, fontWeight: 600,
      fontFamily: preview ? "var(--font-manrope), system-ui, sans-serif" : "Manrope",
    }}>
      <div aria-hidden="true" style={frame} />
      <div aria-hidden="true" style={{ ...frame, top: size(54), right: size(54), bottom: size(54), left: size(54), border: "1px solid #d9bd8b" }} />
      {([0, 90, 180, 270] as const).map((angle) => (
        <div key={angle} aria-hidden="true" style={{
          display: "flex", position: "absolute",
          ...(angle < 180 ? { top: size(61) } : { bottom: size(61) }),
          ...(angle === 0 || angle === 270 ? { left: size(61) } : { right: size(61) }),
        }}>
          <WinterPostCorner size={size(34)} angle={angle} />
        </div>
      ))}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: size(18), borderBottom: "1px solid #d9bd8b", flexShrink: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", color: green, gap: size(5) }}>
          <div style={{ fontSize: size(20, 9), letterSpacing: size(7), textTransform: "uppercase" }}>Зимняя почта</div>
          <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: size(57, 23), lineHeight: 1.06 }}>Почта Деда Мороза</div>
        </div>
        <div aria-hidden="true" style={{ display: "flex", alignItems: "center", gap: size(16), color: burgundy }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: size(3), borderTop: `1px solid ${burgundy}`, borderBottom: `1px solid ${burgundy}`, paddingTop: size(5), paddingBottom: size(5) }}>
            <div style={{ fontSize: size(14, 7), letterSpacing: size(1.5), textTransform: "uppercase" }}>Принято</div>
            <div style={{ fontSize: size(22, 9), letterSpacing: size(3) }}>31.12</div>
          </div>
          <WinterPostStamp width={size(126, 38)} height={size(98, 30)} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: size(layout.gap, 8), flexShrink: 0 }}>
        <h3 style={{ margin: 0, fontFamily: serif, fontStyle: "italic", fontSize: size(layout.heading, 22), lineHeight: 1.08, fontWeight: 600, color: burgundy, wordBreak: layout.splitHeading ? "break-all" : "break-word" }}>
          {greeting}
        </h3>
        {paragraphs.map((paragraph, index) => (
          <p key={index} style={{ margin: 0, fontFamily: preview ? "Caveat, var(--font-manrope), sans-serif" : "Caveat, Manrope", fontWeight: 700, fontSize: size(layout.font, 17), lineHeight: layout.line, wordBreak: "break-word" }}>
            {paragraph}
          </p>
        ))}
      </div>

      <div style={{ display: "flex", flexGrow: 1, flexShrink: 0, alignItems: "center", justifyContent: "center" }}>
        {/* Shared with the server renderer, which supplies a local data URI. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={landscapeSrc}
          alt=""
          width={1000}
          height={333}
          style={{ width: size(1000), height: size(333), flexShrink: 0 }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: size(20), borderTop: "1px solid #d9bd8b", paddingTop: size(16), flexShrink: 0, opacity: locked ? 0.74 : 1 }}>
        <SnowSeal size={size(122, 38)} initial={letter.initial} fontSize={size(58, 19)} serif={serif} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: size(4), textAlign: "right" }}>
          <WinterPostFlourish width={size(276, 88)} height={size(51, 16)} />
          <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: size(41, 16), lineHeight: 1.12, color: burgundy }}>
            {invitationDisplayText(letter.signoff)}
          </div>
        </div>
      </div>

      <div aria-hidden="true" style={{ display: "flex", position: "absolute", bottom: size(14), left: 0, right: 0, justifyContent: "center", fontSize: size(15, 7), letterSpacing: size(2), color: green }}>
        MyWishList · my-wish-list.online
      </div>
      {locked && <SampleWatermark />}
    </div>
  );
}
