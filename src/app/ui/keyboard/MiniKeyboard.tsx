import { BLACK, WHITE } from "./keys.ts";

/**
 * Un petit clavier, dans la barre de statut, ses touches marquées : la note ou l'accord, et d'une autre couleur la voisine
 * de trille et les petites notes (celles de la coloration du texte).
 */
export function MiniKeyboard({ keys, trill, graces = [], title }: { keys: number[]; trill?: number; graces?: number[]; title?: string }) {
  const whiteWidth = 7,
    whiteHeight = 18,
    blackWidth = 4.4,
    blackHeight = 11;
  // la note : le jaune de la case en surbrillance ; la trille et les petites notes, les couleurs de la coloration du texte
  const kind = (note: number) =>
    keys.includes(note) ? "fill-[#ffc53d]" : note === trill ? "fill-[#0f7b6c]" : graces.includes(note) ? "fill-[#7a4fb0]" : undefined;
  return (
    <svg
      className="inline align-[-5px] mr-1 ml-1.5"
      viewBox={`0 0 ${WHITE.length * whiteWidth + 1} ${whiteHeight + 1}`}
      width={WHITE.length * whiteWidth + 1}
      height={whiteHeight + 1}
      role="img"
      aria-label={title ?? `touches ${keys.join(", ")}`}
    >
      {title && <title>{title}</title>}
      {WHITE.map((note, index) => (
        <rect
          key={note}
          x={index * whiteWidth + 0.5}
          y={0.5}
          width={whiteWidth}
          height={whiteHeight}
          rx={1}
          className={`stroke-[#8a8d87] [stroke-width:0.7] ${kind(note) ?? "fill-white"}`}
        />
      ))}
      {BLACK.map(([note, at]) => (
        <rect
          key={note}
          x={at * whiteWidth + 0.5 - blackWidth / 2}
          y={0.5}
          width={blackWidth}
          height={blackHeight}
          rx={0.8}
          className={`stroke-[#1f2123] [stroke-width:0.7] ${kind(note) ?? "fill-[#3a3d40]"}`}
        />
      ))}
    </svg>
  );
}
