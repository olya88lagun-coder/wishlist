export function StoreTile({ monogram, storeLabel, isMustHave, imageUrl, pending }: {
  monogram: string;
  storeLabel: string | null;
  isMustHave?: boolean;
  imageUrl?: string | null;
  pending?: boolean;
}) {
  return (
    <div className={pending ? "tile tile--loading" : "tile"} aria-hidden="true">
      {imageUrl ? (
        // Фото уже сжаты воркером в WebP 800px; next/image не нужен и не тратит память web-контейнера
        <img className="tile__img" src={imageUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
      ) : (
        <span className="tile__monogram">{monogram}</span>
      )}
      {storeLabel && <span className="tile__store">{storeLabel}</span>}
      {isMustHave && <span className="tile__heart">♥</span>}
    </div>
  );
}
