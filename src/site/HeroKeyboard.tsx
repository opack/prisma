/**
 * Le clavier de l'accueil : deux octaves, chaque touche porte son numéro Prisma, et chaque octave
 * la couleur de son couloir sur la partition. Survoler une touche montre la même touche dans
 * l'autre octave : même numéro, même place sous la main. Sur un écran étroit, les deux octaves
 * s'empilent, l'aiguë au-dessus, comme leurs lignes sur la partition.
 */
import { useEffect, useState } from "react";
import { octaveTint } from "../app/colors.ts";

const WHITE = [1, 3, 5, 6, 8, 10, 12];
const BLACK: [number, number][] = [
  [2, 1],
  [4, 2],
  [7, 4],
  [9, 5],
  [11, 6],
];
const OCTAVES = [0, 1];
const NARROW = "(max-width: 600px)";
/** Le numéro d'une touche. */
const NUM = "font-ui font-bold pointer-events-none";

/** Vrai tant que l'écran est étroit. */
function useNarrow() {
  const [narrow, setNarrow] = useState(() => matchMedia(NARROW).matches);
  useEffect(() => {
    const m = matchMedia(NARROW);
    const on = () => setNarrow(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return narrow;
}

export function HeroKeyboard() {
  const [hover, setHover] = useState<number | null>(null);
  const stacked = useNarrow();
  const W = 46, H = 168, BW = 28, BH = 104, LANE = 30, GAP = 14;
  const width = stacked ? W * 7 : W * 7 * OCTAVES.length;
  const height = stacked ? OCTAVES.length * (H + LANE) + (OCTAVES.length - 1) * GAP : H + LANE;
  const name = (o: number) => (o > 0 ? `+${o}` : String(o));
  return (
    <svg className="block w-full max-w-[360px] min-[601px]:max-w-none h-auto touch-manipulation" viewBox={`0 0 ${width + 2} ${height + 2}`} role="img" aria-label="Deux octaves du clavier : chaque touche porte son numéro, de 1 (do) à 12 (si), dans chaque octave.">
      {OCTAVES.map((o, oi) => {
        const tint = octaveTint("rainbow", o)!;
        const x0 = stacked ? 1 : 1 + oi * W * 7;
        const y0 = stacked ? (OCTAVES.length - 1 - oi) * (H + LANE + GAP) : 0;
        return (
          <g key={o} transform={`translate(0 ${y0})`}>
            {/* le couloir de l'octave, comme sur la partition, et son numéro */}
            <rect x={x0} y={1} width={W * 7} height={LANE - 4} rx={4} fill={tint.band} />
            <rect x={x0} y={1} width={40} height={LANE - 4} rx={4} fill={tint.tab} />
            <text x={x0 + 20} y={LANE / 2 + 3} className="font-ui font-bold text-[14px] fill-ink" textAnchor="middle">
              {name(o)}
            </text>
            <text x={x0 + 52} y={LANE / 2 + 3} className="font-ui text-[13px] fill-muted">
              octave {name(o)}
            </text>
            {WHITE.map((n, i) => {
              const on = hover === n;
              return (
                <g key={n} onPointerEnter={() => setHover(n)} onPointerLeave={() => setHover(null)}>
                  <rect x={x0 + i * W} y={LANE} width={W} height={H} rx={5} className={"stroke-[#8f938d] stroke-1" + (on ? " fill-[#ffc53d]" : "")} style={{ fill: on ? undefined : tint.band }} />
                  <text x={x0 + i * W + W / 2} y={LANE + H - 16} textAnchor="middle" className={`${NUM} text-[17px] fill-ink`}>
                    {n}
                  </text>
                </g>
              );
            })}
            {BLACK.map(([n, at]) => {
              const on = hover === n;
              return (
                <g key={n} onPointerEnter={() => setHover(n)} onPointerLeave={() => setHover(null)}>
                  <rect x={x0 + at * W - BW / 2} y={LANE} width={BW} height={BH} rx={4} className={`stroke-[#1c1e20] stroke-1 ${on ? "fill-[#ffc53d]" : "fill-[#2a2d30]"}`} />
                  <text x={x0 + at * W} y={LANE + BH - 12} textAnchor="middle" className={`${NUM} text-[13px] ${on ? "fill-ink" : "fill-white"}`}>
                    {n}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
