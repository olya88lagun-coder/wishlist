export function ReservedSticker({ label = "занято" }: { label?: string }) {
  return <span className="sticker sticker--reserved">{label}</span>;
}
