"use client";

import { type CSSProperties, useEffect, useState } from "react";
import { type Flake, prefersReducedMotion, snowflakes } from "@/lib/motion";

const STORAGE_KEY = "snow-off";
const FLAKES = 22;

function readOff(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
}

function writeOff(off: boolean) {
  try { if (off) localStorage.setItem(STORAGE_KEY, "1"); else localStorage.removeItem(STORAGE_KEY); } catch { /* приватный режим */ }
}

// Снег в первом экране. Сезон решает сервер, чтобы разметка совпала при гидратации
export function SeasonalSnow() {
  const [flakes, setFlakes] = useState<Flake[] | null>(null);
  const [off, setOff] = useState(true);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    setOff(readOff());
    setFlakes(snowflakes(FLAKES));
  }, []);

  if (!flakes) return null;
  const toggle = () => { writeOff(!off); setOff(!off); };

  return (
    <>
      {!off && (
        <div className="snow" aria-hidden="true">
          {flakes.map((flake, index) => (
            <span
              key={index}
              className="snow__flake"
              style={{
                left: `${flake.left}%`,
                width: flake.size,
                height: flake.size,
                animationDelay: `${flake.delay}s`,
                animationDuration: `${flake.duration}s`,
                "--drift": `${flake.drift}px`,
              } as CSSProperties}
            />
          ))}
        </div>
      )}
      <button type="button" className="snow-toggle" onClick={toggle} aria-pressed={!off} aria-label={off ? "Включить снег" : "Выключить снег"} title={off ? "Включить снег" : "Выключить снег"}>
        ❄
      </button>
    </>
  );
}
