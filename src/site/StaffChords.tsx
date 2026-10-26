/**
 * Do mi sol et mi sol si sur une portée en clé de sol, dessinés à la main : la même forme, trois
 * notes sur trois lignes voisines, pour un accord majeur et un accord mineur.
 */

const GAP = 10; // l'écart entre deux lignes de la portée
const BOTTOM = 80; // la ligne du bas, celle du mi
/** La hauteur d'une note, en demi-écarts au-dessus du mi de la ligne du bas (do : -2). */
const y = (step: number) => BOTTOM - (step * GAP) / 2;

const CHORDS = [
  { x: 92, steps: [-2, 0, 2], name: "do mi sol", kind: "majeur" },
  { x: 168, steps: [0, 2, 4], name: "mi sol si", kind: "mineur" },
];

export function StaffChords() {
  return (
    <svg className="block w-[300px] max-w-full h-auto p-3 border border-line rounded-[10px] bg-white box-content" viewBox="0 0 220 132" role="img" aria-label="Sur une portée en clé de sol, do mi sol et mi sol si : trois notes sur trois lignes voisines, la même forme.">
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={i} x1={6} x2={214} y1={BOTTOM - i * GAP} y2={BOTTOM - i * GAP} stroke="#1b1d1f" strokeWidth={1} />
      ))}
      <text x={8} y={BOTTOM + 8} className="font-['Noto_Music','Segoe_UI_Symbol','Apple_Symbols','Bravura',serif] text-[58px]">
        𝄞
      </text>
      {CHORDS.map((c) => (
        <g key={c.x}>
          {c.steps.includes(-2) && <line x1={c.x - 11} x2={c.x + 11} y1={y(-2)} y2={y(-2)} stroke="#1b1d1f" strokeWidth={1} />}
          {c.steps.map((s) => (
            <ellipse key={s} cx={c.x} cy={y(s)} rx={6.4} ry={4.6} transform={`rotate(-20 ${c.x} ${y(s)})`} fill="#1b1d1f" />
          ))}
          <text x={c.x} y={112} textAnchor="middle" className="font-ui text-[11px] fill-ink" fontStyle="italic">
            {c.name}
          </text>
          <text x={c.x} y={127} textAnchor="middle" className="font-ui text-[10px] fill-muted">
            {c.kind}
          </text>
        </g>
      ))}
    </svg>
  );
}
