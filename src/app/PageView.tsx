import type { Meta, SystemRow } from "../core/index.ts";
import { G, PAGE } from "./engrave.ts";
import type { Page, PlacedSystem } from "./engrave.ts";

const INK = "#1b1d1f";
const GREY = "#8a8f94";
const LIGHT = "#c9cdd1";
const BAND = "#f1f2ee";

const FONT = `"Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif`;

function Row({ ps, row, y, band }: { ps: PlacedSystem; row: SystemRow; y: number; band: boolean }) {
  const { sys, xs, ws } = ps;
  const x0 = PAGE.marginX;
  const right = xs[xs.length - 1] + ws[ws.length - 1];
  const base = y + G.rowH * 0.74;
  return (
    <g>
      {band && <rect x={x0 + G.prefix} y={y} width={right - x0 - G.prefix} height={G.rowH} fill={BAND} />}
      {row.showOctave && (
        <text x={x0 + G.prefix - 1.4} y={base} fontSize={3} fontWeight={700} textAnchor="end" fill={INK}>
          {row.octave}
        </text>
      )}
      {row.cells.map((c, a) => {
        if (!c) return null;
        const ci = sys.anchors[a];
        const x = xs[ci];
        const w = ws[ci];
        if (c === "-") {
          return <line key={a} x1={x + w * 0.22} x2={x + w * 0.62} y1={y + G.rowH / 2} y2={y + G.rowH / 2} stroke={INK} strokeWidth={0.32} />;
        }
        if (c.startsWith("-")) {
          return (
            <text key={a} x={x + 0.5} y={base} fontSize={3.1} fill={GREY}>
              {"–" + c.slice(1)}
            </text>
          );
        }
        return (
          <text key={a} x={x + 0.5} y={base} fontSize={3.3} fontWeight={600} fill={INK}>
            {c}
          </text>
        );
      })}
    </g>
  );
}

function SystemView({ ps }: { ps: PlacedSystem }) {
  const { sys, xs, ws, y } = ps;
  const x0 = PAGE.marginX;
  const left = x0 + G.prefix;
  const right = xs[xs.length - 1] + ws[ws.length - 1];
  const rulerBase = y + G.rulerH * 0.72;
  const top = y;
  const rhTop = y + G.rulerH;
  const handY = rhTop + sys.right.length * G.rowH + G.handGap;
  const lhTop = handY + G.handGap;
  const bottom = lhTop + sys.left.length * G.rowH;

  // bandes alternées par groupe d'octave, dans chaque main
  const bands = (rows: SystemRow[]) => {
    let group = -1;
    return rows.map((r) => {
      if (r.showOctave) group++;
      return group % 2 === 1;
    });
  };
  const rb = bands(sys.right);
  const lb = bands(sys.left);

  return (
    <g>
      {/* numéro de la première mesure */}
      <text x={x0 + G.prefix - 1.4} y={rulerBase} fontSize={2.3} fill={GREY} textAnchor="end" fontStyle="italic">
        {sys.bar}
      </text>
      {/* règle de comptage */}
      {sys.anchors.map((ci, a) => {
        const col = sys.columns[ci];
        if (col.kind !== "anchor" || !col.label) return null;
        const beat = col.k === 0;
        return (
          <text key={a} x={xs[ci] + 0.5} y={rulerBase} fontSize={beat ? 2.9 : 2.6} fontWeight={beat ? 700 : 400} fill={beat ? INK : GREY}>
            {col.label}
          </text>
        );
      })}
      <line x1={left} x2={right} y1={rhTop} y2={rhTop} stroke={LIGHT} strokeWidth={0.25} />

      {sys.right.map((r, i) => (
        <Row key={"d" + i} ps={ps} row={r} y={rhTop + i * G.rowH} band={rb[i]} />
      ))}
      <line x1={left} x2={right} y1={handY} y2={handY} stroke={INK} strokeWidth={0.5} />
      {sys.left.map((r, i) => (
        <Row key={"g" + i} ps={ps} row={r} y={lhTop + i * G.rowH} band={lb[i]} />
      ))}

      {/* séparations verticales : temps fins, mesures épaisses */}
      <line x1={left} x2={left} y1={top} y2={bottom} stroke={INK} strokeWidth={0.45} />
      {sys.columns.map((c, ci) => {
        if (c.kind === "anchor") return null;
        const x = xs[ci] + ws[ci] / 2;
        const bar = c.kind === "barSep";
        return <line key={ci} x1={x} x2={x} y1={top} y2={bottom} stroke={bar ? INK : LIGHT} strokeWidth={bar ? 0.45 : 0.22} />;
      })}
    </g>
  );
}

export function PageView({ page, total, meta }: { page: Page; total: number; meta: Meta }) {
  return (
    <svg
      className="page"
      viewBox={`0 0 ${PAGE.w} ${PAGE.h}`}
      width={`${PAGE.w}mm`}
      height={`${PAGE.h}mm`}
      fontFamily={FONT}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      <rect width={PAGE.w} height={PAGE.h} fill="#fff" />
      {page.header && (
        <g>
          {meta.titre && (
            <text x={PAGE.w / 2} y={PAGE.marginTop + 6} fontSize={6.4} fontWeight={700} textAnchor="middle" fill={INK}>
              {meta.titre}
            </text>
          )}
          {meta.compositeur && (
            <text x={PAGE.w - PAGE.marginX} y={PAGE.marginTop + 12} fontSize={3.4} textAnchor="end" fill={INK}>
              {meta.compositeur}
            </text>
          )}
          {meta.tempo && (
            <text x={PAGE.marginX} y={PAGE.marginTop + 12} fontSize={3.2} fill={INK}>
              {meta.tempo}
            </text>
          )}
        </g>
      )}
      {page.systems.map((ps, i) => (
        <SystemView key={i} ps={ps} />
      ))}
      <text x={PAGE.w / 2} y={PAGE.h - 8} fontSize={2.6} textAnchor="middle" fill={GREY}>
        {page.index + 1} / {total}
      </text>
    </svg>
  );
}
