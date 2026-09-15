export function StoreTile({ monogram, storeLabel, isMustHave }: { monogram: string; storeLabel: string | null; isMustHave?: boolean }) {
  return (
    <div className="tile" aria-hidden="true">
      <span className="tile__monogram">{monogram}</span>
      {storeLabel && <span className="tile__store">{storeLabel}</span>}
      {isMustHave && <span className="tile__heart">♥</span>}
    </div>
  );
}
