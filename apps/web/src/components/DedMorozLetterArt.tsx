export function WinterPostStamp({ width, height }: { width: number | string; height: number | string }) {
  return (
    <svg width={124} height={96} style={{ width, height, flexShrink: 0 }} viewBox="0 0 124 96" aria-hidden="true">
      <rect x="2" y="2" width="120" height="92" rx="4" fill="#f6e9ce" stroke="#a07943" strokeWidth="2.3" strokeDasharray="2 4" />
      <rect x="8" y="8" width="108" height="80" rx="1" fill="#355246" />
      <path d="M13 71c15-4 24-4 40 0s35 9 59-2v14H13Z" fill="#79866e" />
      <path d="M22 22a13 13 0 1 0 14 19 11 11 0 0 1-14-19Z" fill="#dfbb7c" />
      <path d="M84 18v14m-7-7h14m6 15v8m-4-4h8m-44-22v8m-4-4h8" stroke="#ead09c" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M42 66h48c9 0 16-4 16-8m-58 7-4-13c-1-4 3-5 5-2l4 6h19c9 0 13-3 18-10l5 3-9 12H54m9 1-4 5m16-5 5 5" fill="none" stroke="#fff2d3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 78h22m62 0h13" stroke="#e0bd80" strokeWidth="1" />
    </svg>
  );
}

export function WinterPostFlourish({ width, height }: { width: number | string; height: number | string }) {
  return (
    <svg width={260} height={48} style={{ width, height }} viewBox="0 0 260 48" aria-hidden="true">
      <path d="M4 34c28-16 52-22 70-20 14 2 10 14-9 20-17 6-24-1-10-11 13-10 35-17 53-17 15 0 21 6 13 12-9 7-27 6-38 8 38-3 63-5 74-1 20 8-23 24-36 13-7-5 7-14 24-16 22-3 36 5 63 2 16-2 34-7 47-16" fill="none" stroke="#852f42" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M58 40c51-3 112-11 179-8" fill="none" stroke="#a07943" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}


export function WinterPostCorner({ size, angle }: { size: number | string; angle: number }) {
  return (
    <svg width={40} height={40} style={{ width: size, height: size, transform: `rotate(${angle}deg)` }} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M3 37V3h34M3 3l25 25M3 16l8-5 5-8M7 22l10-5 5-10m-5 21 8-3 3-8M27 27l-1 8m1-8 8-1" fill="none" stroke="#a07943" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="29" r="1.4" fill="#a07943" /><circle cx="29" cy="12" r="1.4" fill="#a07943" />
    </svg>
  );
}
