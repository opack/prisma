import { BLACK, WHITE } from "./keys.ts";

/**
 * Un petit clavier, dans la barre de statut, ses touches marquées : la note ou l'accord, et d'une autre couleur la voisine
 * de trille et les petites notes (celles de la coloration du texte).
 */
export function MiniKeyboard({ keys, trill, graces = [], title }: { keys: number[]; trill?: number; graces?: number[]; title?: string }) {
  const w = 7, h = 18, bw = 4.4, bh = 11;
  // la note : le jaune de la case en surbrillance ; la trille et les petites notes, les couleurs de la coloration du texte
  const kind = (n: number) => (keys.includes(n) ? "fill-[#ffc53d]" : n === trill ? "fill-[#0f7b6c]" : graces.includes(n) ? "fill-[#7a4fb0]" : undefined);
  return (
    <svg className="inline align-[-5px] mr-1 ml-1.5" viewBox={`0 0 ${WHITE.length * w + 1} ${h + 1}`} width={WHITE.length * w + 1} height={h + 1} role="img" aria-label={title ?? `touches ${keys.join(", ")}`}>
      {title && <title>{title}</title>}
      {WHITE.map((n, i) => (
        <rect key={n} x={i * w + 0.5} y={0.5} width={w} height={h} rx={1} className={`stroke-[#8a8d87] [stroke-width:0.7] ${kind(n) ?? "fill-white"}`} />
      ))}
      {BLACK.map(([n, at]) => (
        <rect key={n} x={at * w + 0.5 - bw / 2} y={0.5} width={bw} height={bh} rx={0.8} className={`stroke-[#1f2123] [stroke-width:0.7] ${kind(n) ?? "fill-[#3a3d40]"}`} />
      ))}
    </svg>
  );
}
