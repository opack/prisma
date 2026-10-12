import { octaveOffset } from "../core/index.ts";
import type { Meta, SystemRow } from "../core/index.ts";
import { G, PAGE } from "./engrave.ts";
import type { Page, PlacedSystem } from "./engrave.ts";
import type { OctavePosition, OctaveStyle, RenderOptions } from "./options.ts";

const INK = "#1b1d1f";
const GREY = "#8a8f94";
const LIGHT = "#c9cdd1";
const LIGHT_TEXT = "#aeb3b8";
const BAND = "#f1f2ee";
const TAB = "#e6e8e3";
const TAB_TEXT = "#4a4f54";

/*
 * Trois sortes de chiffres, trois apparences :
 *  - notes : gras, noir, droit (la seule chose à jouer) ;
 *  - temps : plus petits, italiques, gris ;
 *  - octaves : onglet pâle couvrant le groupe, chiffre gris foncé.
 */

const FONT = `"Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif`;

/**
 * Numéro d'octave : « 0 » pour l'octave du do central, sinon une flèche dessinée
 * (vers le haut pour les octaves aiguës) suivie de l'écart. La flèche est tracée
 * plutôt que prise dans la police, pour avoir la même épaisseur partout.
 */
function OctaveMark({ cx, cy, offset, style }: { cx: number; cy: number; offset: number; style: OctaveStyle }) {
  if (offset !== 0 && style === "sign") {
    // vrai signe moins (−), plus lisible que le trait d'union
    return (
      <text x={cx} y={cy + 0.95} fontSize={2.7} fontWeight={600} textAnchor="middle" fill={TAB_TEXT}>
        {(offset > 0 ? "+" : "−") + Math.abs(offset)}
      </text>
    );
  }
  if (offset !== 0 && style === "triangle") {
    const up = offset > 0;
    const ax = cx - 0.95;
    const half = 0.95;
    const base = up ? cy + half : cy - half;
    const tip = up ? cy - half : cy + half;
    return (
      <g>
        <path d={`M ${ax - 0.95} ${base} L ${ax + 0.95} ${base} L ${ax} ${tip} Z`} fill={TAB_TEXT} />
        <text x={cx + 0.35} y={cy + 0.95} fontSize={2.7} fontWeight={600} fill={TAB_TEXT}>
          {Math.abs(offset)}
        </text>
      </g>
    );
  }
  if (offset === 0) {
    return (
      <text x={cx} y={cy + 0.95} fontSize={2.7} fontWeight={600} textAnchor="middle" fill={TAB_TEXT}>
        0
      </text>
    );
  }
  const up = offset > 0;
  const ax = cx - 0.95; // flèche à gauche, chiffre à droite
  const half = 1.25; // demi-hauteur de la flèche
  const tip = up ? cy - half : cy + half;
  const tail = up ? cy + half : cy - half;
  const head = up ? 0.85 : -0.85;
  return (
    <g>
      <path
        d={`M ${ax} ${tail} L ${ax} ${tip} M ${ax - 0.75} ${tip + head} L ${ax} ${tip} L ${ax + 0.75} ${tip + head}`}
        fill="none"
        stroke={TAB_TEXT}
        strokeWidth={0.42}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text x={cx + 0.35} y={cy + 0.95} fontSize={2.7} fontWeight={600} fill={TAB_TEXT}>
        {Math.abs(offset)}
      </text>
    </g>
  );
}

/** Onglet vertical pâle couvrant les lignes d'un groupe d'octave ; numéro en haut ou au centre selon les options. */
function OctaveTabs({ rows, top, style, position }: { rows: SystemRow[]; top: number; style: OctaveStyle; position: OctavePosition }) {
  const groups: { octave: number; first: number; count: number }[] = [];
  rows.forEach((r, i) => {
    if (r.showOctave || !groups.length) groups.push({ octave: r.octave, first: i, count: 1 });
    else groups[groups.length - 1].count++;
  });
  const x = PAGE.marginX + 0.6;
  const w = G.prefix - 1.4;
  return (
    <g>
      {groups.map((g) => {
        const y = top + g.first * G.rowH + 0.25;
        const h = g.count * G.rowH - 0.5;
        return (
          <g key={g.first}>
            <rect x={x} y={y} width={w} height={h} rx={0.6} fill={TAB} />
            <OctaveMark
              cx={x + w / 2}
              cy={position === "top" ? top + g.first * G.rowH + G.rowH / 2 : y + h / 2}
              offset={octaveOffset(g.octave)}
              style={style}
            />
          </g>
        );
      })}
    </g>
  );
}

function Row({ ps, row, y, centered }: { ps: PlacedSystem; row: SystemRow; y: number; centered: boolean }) {
  const { sys, xs, ws } = ps;
  const x0 = PAGE.marginX;
  const right = xs[xs.length - 1] + ws[ws.length - 1];
  const base = y + G.rowH * 0.74;
  return (
    <g>
      {row.cells.map((c, a) => {
        if (!c) return null;
        // option « notes centrées » : le bloc de notes est centré dans son couloir
        const dy = centered ? row.center[a] * G.rowH : 0;
        const ci = sys.anchors[a];
        const x = xs[ci];
        const w = ws[ci];
        if (c === "-") {
          return <line key={a} x1={x + w * 0.22} x2={x + w * 0.62} y1={y + dy + G.rowH / 2} y2={y + dy + G.rowH / 2} stroke={INK} strokeWidth={0.32} />;
        }
        if (c.startsWith("-")) {
          return (
            <text key={a} x={x + 0.5} y={base + dy} fontSize={3.1} fill={GREY}>
              {"–" + c.slice(1)}
            </text>
          );
        }
        return (
          <text key={a} x={x + 0.5} y={base + dy} fontSize={3.3} fontWeight={600} fill={INK}>
            {c}
          </text>
        );
      })}
    </g>
  );
}

type BarCol = Extract<PlacedSystem["sys"]["columns"][number], { kind: "barSep" }>;

/**
 * Barre de mesure, avec ses signes de reprise : « :|| » (points, trait fin, trait épais),
 * « ||: » (trait épais, trait fin, points). Les points sont placés au milieu de chaque main.
 */
function BarLine({ x, w, col, top, bottom, sections }: { x: number; w: number; col: BarCol; top: number; bottom: number; sections: number[][] }) {
  const thin = (lx: number, k: string) => <line key={k} x1={lx} x2={lx} y1={top} y2={bottom} stroke={INK} strokeWidth={0.22} />;
  const thick = (lx: number, k: string) => <line key={k} x1={lx} x2={lx} y1={top} y2={bottom} stroke={INK} strokeWidth={0.6} />;
  const dots = (dx: number, k: string) =>
    sections.map(([a, b], i) => {
      const mid = (a + b) / 2;
      return (
        <g key={k + i}>
          <circle cx={dx} cy={mid - 0.95} r={0.38} fill={INK} />
          <circle cx={dx} cy={mid + 0.95} r={0.38} fill={INK} />
        </g>
      );
    });
  if (col.lead) return <g>{thin(x + 0.55, "t")}{dots(x + w - 0.75, "d")}</g>;
  if (!col.endRepeat && !col.startRepeat) {
    // fin du morceau : double barre, trait fin puis trait épais
    if (col.final) return <g>{thin(x + w - 1.25, "t")}{thick(x + w - 0.45, "T")}</g>;
    return <line x1={x + w / 2} x2={x + w / 2} y1={top} y2={bottom} stroke={INK} strokeWidth={0.45} />;
  }
  if (col.endRepeat && col.startRepeat) {
    const m = x + w / 2;
    return <g>{dots(x + 0.6, "a")}{thin(m - 0.75, "t1")}{thick(m, "T")}{thin(m + 0.75, "t2")}{dots(x + w - 0.6, "b")}</g>;
  }
  if (col.endRepeat) return <g>{dots(x + 0.6, "a")}{thin(x + w - 1.25, "t")}{thick(x + w - 0.45, "T")}</g>;
  return <g>{thick(x + 0.45, "T")}{thin(x + 1.25, "t")}{dots(x + w - 0.6, "b")}</g>;
}

/** Bandes au-dessus de la règle : textes (rit., D.C.…), puis crochets des cases et « 3× ». */
function Marks({ ps }: { ps: PlacedSystem }) {
  const { sys, xs, ws } = ps;
  const left = PAGE.marginX + G.prefix;
  const right = xs[xs.length - 1] + ws[ws.length - 1];
  const ax = (a: number) => xs[sys.anchors[a]];
  const aEnd = (a: number) => xs[sys.anchors[a]] + ws[sys.anchors[a]];
  const textY = ps.y + G.markH * 0.72;
  const by = ps.y + ps.textBand + 0.9; // trait horizontal des crochets
  // les crochets verticaux s'arrêtent un peu au-dessus de la règle, sans toucher la barre de mesure
  const hookBottom = ps.y + ps.textBand + ps.endingBand - 0.9;
  return (
    <g>
      {sys.marks
        .filter((m) => m.kind === "text")
        .map((m, i) => (
          <text key={"t" + i} x={ax(m.anchor!) + 0.5} y={textY} fontSize={2.9} fontStyle="italic" fill={INK}>
            {m.text}
          </text>
        ))}
      {sys.endings.map((e, i) => {
        // le crochet va d'une barre de mesure à l'autre, comme sur une partition
        const barX = (c: number) => xs[c] + ws[c] / 2;
        // un peu d'espace de part et d'autre de la barre : deux cases consécutives ne se touchent pas
        const gap = 0.6;
        const x1 = (e.fromColumn >= 0 ? barX(e.fromColumn) : left) + gap;
        const x2 = (e.toColumn >= 0 ? barX(e.toColumn) : right) - gap;
        const label = e.ending.numbers.map((n) => n + ".").join(" ");
        return (
          <g key={"e" + i}>
            <path
              d={`${e.opens ? `M ${x1} ${hookBottom} L ${x1} ${by}` : `M ${x1} ${by}`} L ${x2} ${by}${e.hook ? ` L ${x2} ${hookBottom}` : ""}`}
              fill="none"
              stroke={INK}
              strokeWidth={0.3}
            />
            {e.opens && (
              <text x={x1 + 0.8} y={by + 2.6} fontSize={2.6} fontWeight={700} fill={INK}>
                {label}
              </text>
            )}
          </g>
        );
      })}
      {sys.marks
        .filter((m) => m.kind === "times")
        .map((m, i) => (
          <text key={"x" + i} x={aEnd(m.anchor!) - 0.4} y={by + 2.6} fontSize={2.6} fontWeight={700} textAnchor="end" fill={INK}>
            {m.text}
          </text>
        ))}
    </g>
  );
}

function SystemView({ ps, options }: { ps: PlacedSystem; options: RenderOptions }) {
  const { sys, xs, ws } = ps;
  const y = ps.y + ps.textBand + ps.endingBand; // haut de la règle de comptage
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
      {/* numéro de la première mesure, préfixé de « m » pour ne pas le confondre avec les temps */}
      <text x={x0 + G.prefix - 1.2} y={rulerBase} fontSize={2.3} fill={GREY} textAnchor="end" fontStyle="italic">
        {"m" + sys.bar}
      </text>
      {/* règle de comptage */}
      {sys.anchors.map((ci, a) => {
        const col = sys.columns[ci];
        if (col.kind !== "anchor" || !col.label) return null;
        const beat = col.k === 0;
        return (
          <text
            key={a}
            x={xs[ci] + 0.5}
            y={rulerBase}
            fontSize={beat ? 2.6 : 2.4}
            fontStyle={beat ? "italic" : "normal"}
            fill={beat ? GREY : LIGHT_TEXT}
          >
            {col.label}
          </text>
        );
      })}
      <line x1={left} x2={right} y1={rhTop} y2={rhTop} stroke={LIGHT} strokeWidth={0.25} />

      <OctaveTabs rows={sys.right} top={rhTop} style={options.octaveStyle} position={options.octavePosition} />
      <OctaveTabs rows={sys.left} top={lhTop} style={options.octaveStyle} position={options.octavePosition} />
      {/* fonds des couloirs d'abord : les notes, dessinées ensuite, ne sont jamais recouvertes */}
      {rb.map((b, i) => b && <rect key={"bd" + i} x={left} y={rhTop + i * G.rowH} width={right - left} height={G.rowH} fill={BAND} />)}
      {lb.map((b, i) => b && <rect key={"bg" + i} x={left} y={lhTop + i * G.rowH} width={right - left} height={G.rowH} fill={BAND} />)}
      {sys.right.map((r, i) => (
        <Row key={"d" + i} ps={ps} row={r} y={rhTop + i * G.rowH} centered={options.notePosition === "center"} />
      ))}
      <line x1={left} x2={right} y1={handY} y2={handY} stroke={INK} strokeWidth={0.5} />
      {sys.left.map((r, i) => (
        <Row key={"g" + i} ps={ps} row={r} y={lhTop + i * G.rowH} centered={options.notePosition === "center"} />
      ))}

      {/* séparations verticales : temps fins, mesures épaisses, reprises */}
      <line x1={left} x2={left} y1={top} y2={bottom} stroke={INK} strokeWidth={0.45} />
      {sys.columns.map((c, ci) => {
        if (c.kind === "anchor") return null;
        if (c.kind === "beatSep") {
          const x = xs[ci] + ws[ci] / 2;
          return <line key={ci} x1={x} x2={x} y1={top} y2={bottom} stroke={LIGHT} strokeWidth={0.22} />;
        }
        const sections = [
          sys.right.length ? [rhTop, rhTop + sys.right.length * G.rowH] : null,
          sys.left.length ? [lhTop, lhTop + sys.left.length * G.rowH] : null,
        ].filter(Boolean) as number[][];
        return <BarLine key={ci} x={xs[ci]} w={ws[ci]} col={c} top={top} bottom={bottom} sections={sections} />;
      })}

      <Marks ps={ps} />
    </g>
  );
}

export function PageView({ page, total, meta, options }: { page: Page; total: number; meta: Meta; options: RenderOptions }) {
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
          {meta.title && (
            <text x={PAGE.w / 2} y={PAGE.marginTop + 6} fontSize={6.4} fontWeight={700} textAnchor="middle" fill={INK}>
              {meta.title}
            </text>
          )}
          {meta.composer && (
            <text x={PAGE.w - PAGE.marginX} y={PAGE.marginTop + 12} fontSize={3.4} textAnchor="end" fill={INK}>
              {meta.composer}
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
        <SystemView key={i} ps={ps} options={options} />
      ))}
      <text x={PAGE.w / 2} y={PAGE.h - 8} fontSize={2.6} textAnchor="middle" fill={GREY}>
        {page.index + 1} / {total}
      </text>
    </svg>
  );
}
