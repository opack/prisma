/**
 * Le clavier de l'accueil : deux octaves, chaque touche porte son numéro Prisma, et chaque octave
 * la couleur de son couloir sur la partition. Survoler une touche montre la même touche dans
 * l'autre octave : même numéro, même place sous la main. Sur un écran étroit, les deux octaves
 * s'empilent, l'aiguë au-dessus, comme leurs lignes sur la partition.
 */
import { useEffect, useState } from "react";
import { octaveTint } from "../../app/score/colors.ts";

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
    const mediaQueryList = matchMedia(NARROW);
    const on = () => setNarrow(mediaQueryList.matches);
    mediaQueryList.addEventListener("change", on);
    return () => mediaQueryList.removeEventListener("change", on);
  }, []);
  return narrow;
}

export function HeroKeyboard() {
  const [hover, setHover] = useState<number | null>(null);
  const stacked = useNarrow();
  const whiteWidth = 46,
    whiteHeight = 168,
    blackWidth = 28,
    blackHeight = 104,
    LANE = 30,
    GAP = 14;
  const width = stacked ? whiteWidth * 7 : whiteWidth * 7 * OCTAVES.length;
  const height = stacked ? OCTAVES.length * (whiteHeight + LANE) + (OCTAVES.length - 1) * GAP : whiteHeight + LANE;
  const name = (octave: number) => (octave > 0 ? `+${octave}` : String(octave));
  return (
    <svg
      className="block w-full max-w-[360px] min-[601px]:max-w-none h-auto touch-manipulation"
      viewBox={`0 0 ${width + 2} ${height + 2}`}
      role="img"
      aria-label="Deux octaves du clavier : chaque touche porte son numéro, de 1 (do) à 12 (si), dans chaque octave."
    >
      {OCTAVES.map((octave, octaveIndex) => {
        const tint = octaveTint("rainbow", octave)!;
        const x0 = stacked ? 1 : 1 + octaveIndex * whiteWidth * 7;
        const y0 = stacked ? (OCTAVES.length - 1 - octaveIndex) * (whiteHeight + LANE + GAP) : 0;
        return (
          <g key={octave} transform={`translate(0 ${y0})`}>
            {/* le couloir de l'octave, comme sur la partition, et son numéro */}
            <rect x={x0} y={1} width={whiteWidth * 7} height={LANE - 4} rx={4} fill={tint.band} />
            <rect x={x0} y={1} width={40} height={LANE - 4} rx={4} fill={tint.tab} />
            <text x={x0 + 20} y={LANE / 2 + 3} className="font-ui font-bold text-[14px] fill-ink" textAnchor="middle">
              {name(octave)}
            </text>
            <text x={x0 + 52} y={LANE / 2 + 3} className="font-ui text-[13px] fill-muted">
              octave {name(octave)}
            </text>
            {WHITE.map((note, index) => {
              const on = hover === note;
              return (
                <g key={note} onPointerEnter={() => setHover(note)} onPointerLeave={() => setHover(null)}>
                  <rect
                    x={x0 + index * whiteWidth}
                    y={LANE}
                    width={whiteWidth}
                    height={whiteHeight}
                    rx={5}
                    className={"stroke-[#8f938d] stroke-1" + (on ? " fill-[#ffc53d]" : "")}
                    style={{ fill: on ? undefined : tint.band }}
                  />
                  <text
                    x={x0 + index * whiteWidth + whiteWidth / 2}
                    y={LANE + whiteHeight - 16}
                    textAnchor="middle"
                    className={`${NUM} text-[17px] fill-ink`}
                  >
                    {note}
                  </text>
                </g>
              );
            })}
            {BLACK.map(([note, at]) => {
              const on = hover === note;
              return (
                <g key={note} onPointerEnter={() => setHover(note)} onPointerLeave={() => setHover(null)}>
                  <rect
                    x={x0 + at * whiteWidth - blackWidth / 2}
                    y={LANE}
                    width={blackWidth}
                    height={blackHeight}
                    rx={4}
                    className={`stroke-[#1c1e20] stroke-1 ${on ? "fill-[#ffc53d]" : "fill-[#2a2d30]"}`}
                  />
                  <text
                    x={x0 + at * whiteWidth}
                    y={LANE + blackHeight - 12}
                    textAnchor="middle"
                    className={`${NUM} text-[13px] ${on ? "fill-ink" : "fill-white"}`}
                  >
                    {note}
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
