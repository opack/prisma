/**
 * Un clavier d'une octave, pour montrer des notes Prisma (1 à 12) sur leurs touches : les numéros
 * sont les touches, dans l'ordre, du do (1) au si (12). En petit dans la barre de statut, une note
 * ou un accord marqués ; en grand dans le choix de la note d'une case, où chaque touche se clique.
 */

/** Les touches blanches, de gauche à droite, et les noires avec leur place (en largeurs de touche blanche). */
const WHITE = [1, 3, 5, 6, 8, 10, 12];
const BLACK: [number, number][] = [
  [2, 1],
  [4, 2],
  [7, 4],
  [9, 5],
  [11, 6],
];

/**
 * Un petit clavier, ses touches marquées : la note ou l'accord, et d'une autre couleur la voisine
 * de trille et les petites notes (celles de la coloration du texte).
 */
export function MiniKeyboard({ keys, trill, graces = [], title }: { keys: number[]; trill?: number; graces?: number[]; title?: string }) {
  const w = 7, h = 18, bw = 4.4, bh = 11;
  const kind = (n: number) => (keys.includes(n) ? " on" : n === trill ? " trill" : graces.includes(n) ? " grace" : "");
  return (
    <svg className="mini-keyboard" viewBox={`0 0 ${WHITE.length * w + 1} ${h + 1}`} width={WHITE.length * w + 1} height={h + 1} role="img" aria-label={title ?? `touches ${keys.join(", ")}`}>
      {title && <title>{title}</title>}
      {WHITE.map((n, i) => (
        <rect key={n} x={i * w + 0.5} y={0.5} width={w} height={h} rx={1} className={"key" + kind(n)} />
      ))}
      {BLACK.map(([n, at]) => (
        <rect key={n} x={at * w + 0.5 - bw / 2} y={0.5} width={bw} height={bh} rx={0.8} className={"key black" + kind(n)} />
      ))}
    </svg>
  );
}

/** Le choix d'une note sur un clavier : chaque touche porte son numéro et se clique. */
export function KeyboardPicker({ current, onPick, title }: { current?: string; onPick: (n: string) => void; title?: (n: number) => string }) {
  const key = (n: number, black: boolean, style: React.CSSProperties) => (
    <button key={n} className={"piano-key" + (black ? " black" : "") + (String(n) === current ? " current" : "")} style={style} onClick={() => onPick(String(n))} title={title?.(n)} aria-label={`note ${n}`}>
      {n}
    </button>
  );
  const unit = 100 / WHITE.length;
  return (
    <div className="piano">
      {WHITE.map((n, i) => key(n, false, { left: `${i * unit}%`, width: `${unit}%` }))}
      {BLACK.map(([n, at]) => key(n, true, { left: `${(at - 0.32) * unit}%`, width: `${unit * 0.64}%` }))}
    </div>
  );
}
