/** Le choix d'une note sur un clavier, dans la retouche d'une case : chaque touche porte son numéro et se clique. */
import { BLACK, WHITE } from "./keys.ts";

/** Une touche du clavier de choix : blanche, ou noire par-dessus ; celle de la note, à la couleur de l'accent. */
const pianoKey = (black: boolean, current: boolean) =>
  [
    "absolute top-0 flex items-end justify-center px-0 pt-0 border rounded-[0_0_5px_5px] font-mono font-semibold",
    black ? "z-1 h-[50px] pb-1 text-[11px] text-white" : "h-[84px] pb-1.5 text-[13px]",
    current
      ? `bg-accent border-accent text-white ${black ? "" : "shadow-[inset_0_0_0_1px_var(--color-accent)]"}`
      : black
        ? "bg-[#2a2d30] border-[#2a2d30] hover:bg-[#454a4f]"
        : "bg-white border-[#b9bcb6] text-ink hover:bg-accent-10",
  ].join(" ");

export function KeyboardPicker({ current, onPick, title }: { current?: string; onPick: (n: string) => void; title?: (n: number) => string }) {
  const key = (n: number, black: boolean, style: React.CSSProperties) => (
    <button key={n} className={pianoKey(black, String(n) === current)} style={style} onClick={() => onPick(String(n))} title={title?.(n)} aria-label={`note ${n}`}>
      {n}
    </button>
  );
  const unit = 100 / WHITE.length;
  return (
    <div className="relative h-[84px]">
      {WHITE.map((n, i) => key(n, false, { left: `${i * unit}%`, width: `${unit}%` }))}
      {BLACK.map(([n, at]) => key(n, true, { left: `${(at - 0.32) * unit}%`, width: `${unit * 0.64}%` }))}
    </div>
  );
}
