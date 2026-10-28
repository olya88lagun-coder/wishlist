import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { loadOgFonts } from "../app/[slug]/og-render";
import { formatInvitationDate, invitationAge, invitationDisplayText, invitationSchema, type InvitationInput } from "../lib/invitation";

const DECOR_URL = new URL("../../public/themes/children-decor.png", import.meta.url);
const PINK_DECOR_URL = new URL("../../public/themes/children-decor-pink.png", import.meta.url);

// next/og fetches emoji and missing-script fonts externally. Keep private text
// inside the bundled font's Latin/Cyrillic repertoire; unsupported glyphs use ?.
function offlineText(text: string, maxWordLength = 30): string {
  const local = invitationDisplayText(text);
  // Break only unusually long tokens. Normal words stay intact in the PNG.
  return local.split(" ").map((word) => word.match(new RegExp(`.{1,${maxWordLength}}`, "gu"))?.join(" ") ?? "").join(" ");
}

export async function renderInvitation(input: InvitationInput, shareUrl: string): Promise<Response> {
  const data = invitationSchema.parse(input);
  const accent = data.color === "pink" ? "#f9d4e3" : "#bce5fa";
  const url = new URL(shareUrl);
  if (!/^https?:$/.test(url.protocol) || shareUrl.length > 512) throw new Error("Invalid invitation share URL");
  const [fonts, qr, decor] = await Promise.all([
    loadOgFonts(),
    QRCode.toDataURL(shareUrl, { errorCorrectionLevel: "M", margin: 4, width: 288, color: { dark: "#193e45", light: "#ffffff" } }),
    readFile(data.color === "pink" ? PINK_DECOR_URL : DECOR_URL),
  ]);
  return new ImageResponse(
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: 64, background: "#fff", color: "#193e45", fontFamily: "Manrope", fontWeight: 600 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`data:image/png;base64,${decor.toString("base64")}`} alt="" width={1080} height={360} style={{ position: "absolute", top: 0, left: 0 }} />
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 70, flexShrink: 0 }}>
        <div style={{ display: "flex", borderRadius: 40, padding: "14px 24px", background: accent, fontSize: 27 }}>Будет весело!</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", flexShrink: 0, marginTop: 32, fontSize: 62, lineHeight: 1.12, color: "#c44736" }}><div>Приглашаем на</div><div>день рождения!</div></div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", height: 180, flexShrink: 0, fontSize: data.name.length > 24 ? 50 : 64, lineHeight: 1.12 }}>{offlineText(data.name, 16)}</div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12, minHeight: 220, fontSize: 32, lineHeight: 1.3 }}>
        {data.age && <div style={{ display: "flex", color: "#15736b" }}>{invitationAge(data.age)}</div>}
        <div style={{ display: "flex" }}>{formatInvitationDate(data.date)} · {data.time}</div>
        {data.place && <div style={{ display: "flex", fontSize: 28 }}>{offlineText(data.place)}</div>}
      </div>
      <div style={{ display: "flex", justifyContent: "center", textAlign: "center", height: 220, flexShrink: 0, fontSize: 26, lineHeight: 1.35, paddingTop: 20 }}>{offlineText(data.message || "Очень ждём тебя на празднике!")}</div>
      <div style={{ display: "flex", marginTop: "auto", alignItems: "center", gap: 28, borderTop: `4px solid ${accent}`, paddingTop: 24 }}>
        {/* QR stays on white, with a four-module quiet zone. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="QR-код списка подарков" width={288} height={288} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: 18 }}>
          <div style={{ display: "flex", fontSize: 34, color: "#15736b" }}>Список подарков</div>
          <div style={{ display: "flex", fontSize: shareUrl.length > 100 ? 19 : 25, lineHeight: 1.3, wordBreak: "break-all" }}>{offlineText(shareUrl, 512)}</div>
        </div>
      </div>
    </div>,
    { width: 1080, height: 1440, fonts, headers: { "Cache-Control": "private, no-store", "Content-Disposition": 'attachment; filename="invitation.png"' } },
  );
}
