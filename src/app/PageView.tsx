import { FINGER_MARK, TRILL_MARK, octaveOffset } from "../core/index.ts";
import type { Meta, SystemRow, Voice } from "../core/index.ts";
import { FINGER, G, PAGE, chordParts, graceExtra, graceSlotW, headerHeight, leadExtra, noteParts } from "./engrave.ts";
import type { Page, PlacedSystem } from "./engrave.ts";
import type { OctavePosition, OctaveStyle, RenderOptions } from "./options.ts";
import { octaveTint } from "./colors.ts";

const INK = "#1b1d1f";
const GREY = "#8a8f94";
const LIGHT = "#c9cdd1";
const LIGHT_TEXT = "#aeb3b8";
const BAND = "#f1f2ee";
const TAB = "#e6e8e3";
const TAB_TEXT = "#4a4f54";
const GRACE = "#5a5f64"; // petites notes : gris foncé, entre les notes et les tenues

/*
 * Trois sortes de chiffres, trois apparences :
 *  - notes : gras, noir, droit (la seule chose à jouer) ;
 *  - temps : plus petits, italiques, gris ;
 *  - octaves : onglet pâle couvrant le groupe, chiffre gris foncé.
 */

const FONT = `"Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif`;
/** Nuances en gras italique à empattements, comme sur une partition. */
const DYNAMIC_FONT = `Georgia, "Times New Roman", serif`;

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
function OctaveTabs({ rows, top, style, position, tabFill }: { rows: SystemRow[]; top: number; style: OctaveStyle; position: OctavePosition; tabFill: (octave: number) => string }) {
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
            <rect x={x} y={y} width={w} height={h} rx={0.6} fill={tabFill(g.octave)} />
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
  // petites notes : en petit, en exposant et en gris foncé, en tête de case, rang par rang
  const graces = row.graces.flatMap((list, a) => {
    let x = xs[sys.anchors[a]] + 0.4;
    const dy = centered ? row.center[a] * G.rowH : 0;
    return sys.graceDigits[row.hand][a].map((d, k) => {
      const gx = x;
      x += graceSlotW(d);
      return list[k] ? (
        <text key={`g${a}-${k}`} x={gx} y={base + dy - 1.05} fontSize={2.3} fontWeight={600} fill={GRACE}>
          {list[k]}
        </text>
      ) : null;
    });
  });
  return (
    <g>
      {graces}
      {row.cells.map((c, a) => {
        if (!c) return null;
        // option « notes centrées » : le bloc de notes est centré dans son couloir
        const dy = centered ? row.center[a] * G.rowH : 0;
        const ci = sys.anchors[a];
        // la note vient après les petites notes et l'arpège de sa case
        const extra = leadExtra(sys, a);
        const x = xs[ci] + extra;
        const w = ws[ci] - extra;
        const mid = y + dy + G.rowH / 2;
        // trille : la note, sa voisine en petit, puis un trait ondulé sur toute sa durée
        if (row.trill[a] && c === "-") return <path key={a} d={wave(xs[ci], x + w, mid)} {...WAVE} />;
        // note annotée : la voisine de trille en petit (en haut), le doigt en négatif (en bas à droite)
        if (!c.startsWith("-") && (c.includes(TRILL_MARK) || c.includes(FINGER_MARK))) {
          const { main, aux, finger } = noteParts(c);
          let end = x + 0.5 + main.length * G.noteDigit;
          const auxX = end + 0.35;
          if (aux) end = auxX + aux.length * 1.25;
          const fx = end + FINGER.gap + FINGER.r;
          if (finger) end = fx + FINGER.r;
          return (
            <g key={a}>
              <text x={x + 0.5} y={base + dy} fontSize={3.3} fontWeight={600} fill={INK}>
                {main}
              </text>
              {aux && (
                <text x={auxX} y={base + dy - 1.05} fontSize={2.3} fontWeight={600} fill={GRACE}>
                  {aux}
                </text>
              )}
              {finger && (
                <g>
                  <rect x={fx - FINGER.r} y={base + dy - 1.95} width={2 * FINGER.r} height={2.9} rx={0.6} fill={TAB_TEXT} />
                  <text x={fx} y={base + dy + 0.3} fontSize={2.2} fontWeight={700} textAnchor="middle" fill="#fff">
                    {finger}
                  </text>
                </g>
              )}
              {aux && end + 0.3 < x + w && <path d={wave(end + 0.3, x + w, mid)} {...WAVE} />}
            </g>
          );
        }
        if (row.trill[a]) {
          // trille commencée au système précédent : le rappel « –N », puis l'ondulation
          const end = x + 0.5 + c.length * G.noteDigit;
          return (
            <g key={a}>
              <text x={x + 0.5} y={base + dy} fontSize={3.1} fill={GREY}>
                {"–" + c.slice(1)}
              </text>
              {end < x + w && <path d={wave(end, x + w, mid)} {...WAVE} />}
            </g>
          );
        }
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

/** Trait ondulé horizontal (trille) de x1 à x2, centré sur y. */
function wave(x1: number, x2: number, y: number): string {
  const p = 1.3, amp = 0.35;
  let d = `M ${x1} ${y}`;
  for (let x = x1, k = 0; x < x2 - 0.01; x += p / 2, k++) {
    const nx = Math.min(x + p / 2, x2);
    d += ` Q ${(x + nx) / 2} ${y + (k % 2 ? amp : -amp) * 2} ${nx} ${y}`;
  }
  return d;
}

/** Vaguelette verticale (arpège) de y1 à y2, centrée sur x ; down : flèche vers le bas. */
function vwave(x: number, y1: number, y2: number, down: boolean): string {
  const p = 1.3, amp = 0.35;
  let d = `M ${x} ${y1}`;
  for (let y = y1, k = 0; y < y2 - 0.01; y += p / 2, k++) {
    const ny = Math.min(y + p / 2, y2);
    d += ` Q ${x + (k % 2 ? amp : -amp) * 2} ${(y + ny) / 2} ${x} ${ny}`;
  }
  if (down) d += ` M ${x - 0.7} ${y2 - 0.9} L ${x} ${y2} L ${x + 0.7} ${y2 - 0.9}`;
  return d;
}

const WAVE = { fill: "none", stroke: INK, strokeWidth: 0.3, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

/**
 * Liaisons d'une main : un arc fin, creux vers le haut comme une liaison sous les notes, de
 * la première note à la dernière. Une liaison coupée reste ouverte au bord du système.
 */
function SlurBand({ ps, voice, top }: { ps: PlacedSystem; voice: Voice; top: number }) {
  const { sys, xs, ws } = ps;
  const left = PAGE.marginX + G.prefix;
  const right = xs[xs.length - 1] + ws[ws.length - 1];
  const noteX = (a: number) => xs[sys.anchors[a]] + leadExtra(sys, a) + 1.4;
  return (
    <g>
      {voice.slurs.map((s, i) => {
        const x1 = s.opens ? noteX(s.fromAnchor) : left;
        const x2 = s.closes ? noteX(s.toAnchor) : right;
        const y = top + 0.5 + s.level * G.slurLevel;
        const d = Math.min(1.1, 0.45 + (x2 - x1) * 0.02); // creux, un peu plus marqué pour une longue liaison
        const mx = (x1 + x2) / 2;
        return <path key={i} d={`M ${x1} ${y} Q ${mx} ${y + 2 * d} ${x2} ${y} Q ${mx} ${y + 2 * d - 0.7} ${x1} ${y} Z`} fill={INK} />;
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
  // les points sont centrés dans la place qui leur est réservée (G.repeatDots)
  const d = G.repeatDots / 2;
  if (col.lead) return <g>{thin(x + 0.55, "t")}{dots(x + w - d, "d")}</g>;
  if (!col.endRepeat && !col.startRepeat) {
    // fin du morceau : double barre, trait fin puis trait épais
    if (col.final) return <g>{thin(x + w - 1.25, "t")}{thick(x + w - 0.45, "T")}</g>;
    // début de section : double barre
    if (col.section) {
      // aussi marquée qu'une barre de mesure : deux traits de même épaisseur
      const bar = (lx: number, k: string) => <line key={k} x1={lx} x2={lx} y1={top} y2={bottom} stroke={INK} strokeWidth={0.4} />;
      return <g>{bar(x + w / 2 - 0.45, "t1")}{bar(x + w / 2 + 0.45, "t2")}</g>;
    }
    return <line x1={x + w / 2} x2={x + w / 2} y1={top} y2={bottom} stroke={INK} strokeWidth={0.45} />;
  }
  if (col.endRepeat && col.startRepeat) {
    const m = x + w / 2;
    return <g>{dots(x + d, "a")}{thin(m - 0.75, "t1")}{thick(m, "T")}{thin(m + 0.75, "t2")}{dots(x + w - d, "b")}</g>;
  }
  if (col.endRepeat) return <g>{dots(x + d, "a")}{thin(x + w - 1.25, "t")}{thick(x + w - 0.45, "T")}</g>;
  return <g>{thick(x + 0.45, "T")}{thin(x + 1.25, "t")}{dots(x + w - d, "b")}</g>;
}

/** Lettre de section, en blanc sur fond noir : sur la partition et dans l'ordre de jeu. */
function SectionBox({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g>
      <rect x={x} y={y} width={3.6} height={3.3} rx={0.4} fill={INK} />
      <text x={x + 1.8} y={y + 2.55} fontSize={2.8} fontWeight={700} textAnchor="middle" fill="#fff">
        {label}
      </text>
    </g>
  );
}

/** Point d'orgue : un arc aplati ouvert vers le bas, son point dessous, au-dessus de la note. */
function Fermata({ cx, y }: { cx: number; y: number }) {
  const rx = 1.8;
  const base = y + 2.5;
  return (
    <g>
      <path d={`M ${cx - rx} ${base} A ${rx} 1.25 0 0 1 ${cx + rx} ${base}`} fill="none" stroke={INK} strokeWidth={0.4} />
      <circle cx={cx} cy={base - 0.35} r={0.38} fill={INK} />
    </g>
  );
}

/** Bandes au-dessus de la règle, de haut en bas : textes (rit., a tempo…), puis débuts de section, points d'orgue et « 3× ». */
function Marks({ ps }: { ps: PlacedSystem }) {
  const { sys, xs, ws } = ps;
  const left = PAGE.marginX + G.prefix;
  const ax = (a: number) => xs[sys.anchors[a]];
  const aEnd = (a: number) => xs[sys.anchors[a]] + ws[sys.anchors[a]];
  const textY = ps.y + G.markH * 0.72;
  const top = ps.y + ps.textBand + 0.35; // haut de la bande de structure
  return (
    <g>
      {sys.marks
        .filter((m) => m.kind === "text")
        .map((m, i) => (
          <text key={"t" + i} x={ax(m.anchor!) + 0.5} y={textY} fontSize={2.9} fontStyle="italic" fill={INK}>
            {m.text}
          </text>
        ))}
      {/* début de section : sa lettre contre la barre qui l'ouvre */}
      {sys.marks
        .filter((m) => m.kind === "marker")
        .map((m, i) => {
          const bar = m.column! >= 0 ? xs[m.column!] + ws[m.column!] / 2 : left;
          return <SectionBox key={"r" + i} x={bar + 0.6} y={top} label={m.label!} />;
        })}
      {sys.marks
        .filter((m) => m.kind === "fermata")
        .map((m, i) => (
          <Fermata key={"f" + i} cx={ax(m.anchor!) + leadExtra(sys, m.anchor!) + 1.4} y={top} />
        ))}
      {sys.marks
        .filter((m) => m.kind === "times")
        .map((m, i) => (
          <text key={"x" + i} x={aEnd(m.anchor!) - 0.4} y={top + 2.55} fontSize={2.6} fontWeight={700} textAnchor="end" fill={INK}>
            {m.text}
          </text>
        ))}
    </g>
  );
}

/** Ordre de jeu des sections, en tête de page : les mêmes lettres que sur la partition. */
function OrderLine({ order, y, cx = PAGE.w / 2 }: { order: string[]; y: number; cx?: number }) {
  const step = 3.6 + 1.6;
  const x0 = cx - (order.length * step - 1.6) / 2;
  return (
    <g>
      {order.map((label, i) => (
        <SectionBox key={i} x={x0 + i * step} y={y} label={label} />
      ))}
    </g>
  );
}

/**
 * Bande des nuances d'une main : nuances (p, mf…), textes (cresc., dolce…) et soufflets.
 * Un soufflet coupé par un changement de système garde son ouverture au point de coupure.
 */
function VoiceBand({ ps, voice, top }: { ps: PlacedSystem; voice: Voice; top: number }) {
  const { sys, xs, ws } = ps;
  const ax = (a: number) => xs[sys.anchors[a]];
  const aEnd = (a: number) => xs[sys.anchors[a]] + ws[sys.anchors[a]];
  const cy = top + G.voiceH / 2;
  const base = top + G.voiceH * 0.7;
  const open = 0.95; // demi-ouverture maximale d'un soufflet
  // halo blanc : le texte reste lisible quand il traverse une séparation de temps
  const halo = { stroke: "#fff", strokeWidth: 0.6, paintOrder: "stroke" as const, strokeLinejoin: "round" as const };
  return (
    <g>
      {voice.hairpins.map((h, i) => {
        const x1 = ax(h.fromAnchor) + (h.from === 0 ? 0.5 : 0);
        const x2 = aEnd(h.toAnchor) - (h.to === 1 ? 0.6 : 0);
        const size = (f: number) => (h.kind === "<" ? f : 1 - f) * open;
        const a = size(h.from), b = size(h.to);
        return (
          <path
            key={"h" + i}
            d={`M ${x2} ${cy - b} L ${x1} ${cy - a} ${a === 0 ? "" : `M ${x1} ${cy + a}`} L ${x2} ${cy + b}`}
            fill="none"
            stroke={INK}
            strokeWidth={0.28}
            strokeLinejoin="round"
          />
        );
      })}
      {voice.marks.map((m, i) =>
        // l'arpège se dessine devant l'accord (voir SystemView), pas dans cette bande
        m.kind === "arpeggio" ? null : m.kind === "dynamic" ? (
          <text key={"m" + i} x={ax(m.anchor) + 0.9} y={base} fontFamily={DYNAMIC_FONT} fontSize={3.6} fontWeight={700} fontStyle="italic" fill={INK} {...halo}>
            {m.text}
          </text>
        ) : (
          <text key={"m" + i} x={ax(m.anchor) + 0.7} y={base} fontSize={2.8} fontStyle="italic" fill={INK} {...halo}>
            {m.text}
          </text>
        ),
      )}
    </g>
  );
}

/**
 * Pédale : trait sous le système, comme sur les partitions modernes. Il commence par un
 * crochet là où la pédale s'enfonce, finit par un crochet là où elle se relâche, et
 * marque d'une pointe chaque changement. Sa longueur montre exactement ce qui est tenu.
 */
function PedalBand({ ps, top }: { ps: PlacedSystem; top: number }) {
  const { sys, xs, ws } = ps;
  const left = PAGE.marginX + G.prefix;
  const right = xs[xs.length - 1] + ws[ws.length - 1];
  const y = top + G.pedalH * 0.7;
  const hook = 1.5; // hauteur des crochets et des pointes
  const notch = 0.8; // demi-largeur d'une pointe de changement
  const px = (a: number) => xs[sys.anchors[a]] + 0.3;
  const parts: string[] = [];
  for (const s of sys.pedal.spans) {
    let x1 = s.fromAnchor >= 0 ? px(s.fromAnchor) : left;
    let x2 = s.toAnchor >= 0 ? px(s.toAnchor) : right;
    if (s.changeStart) {
      // pointe du changement, dessinée une seule fois, par la pédale qui commence
      parts.push(`M ${x1 - notch} ${y} L ${x1} ${y - hook} L ${x1 + notch} ${y}`);
      x1 += notch;
    } else if (s.opens) parts.push(`M ${x1} ${y - hook} L ${x1} ${y}`);
    // un changement en fin de système se dessine au début du système suivant
    if (s.changeEnd && s.toAnchor >= 0) x2 -= notch;
    parts.push(`M ${x1} ${y} L ${x2} ${y}`);
    if (s.closes && !s.changeEnd) parts.push(`M ${x2} ${y} L ${x2} ${y - hook}`);
  }
  return (
    <g>
      <text x={PAGE.marginX + G.prefix - 1.2} y={y} fontSize={2.3} fill={GREY} textAnchor="end" fontStyle="italic">
        Ped.
      </text>
      <path d={parts.join(" ")} fill="none" stroke={INK} strokeWidth={0.3} strokeLinejoin="round" />
      {/* consignes (« Ped. simile ») : sur la ligne de pédale, après un éventuel crochet */}
      {sys.pedal.texts.map((p, i) => (
        <text key={i} x={px(p.anchor) + 0.8} y={y} fontSize={2.8} fontStyle="italic" fill={INK}>
          {p.text}
        </text>
      ))}
    </g>
  );
}

function SystemView({ ps, options }: { ps: PlacedSystem; options: RenderOptions }) {
  const { sys, xs, ws } = ps;
  const chordTop = ps.y + ps.textBand + ps.structBand; // bande des accords, juste au-dessus de la règle
  const y = chordTop + ps.chordBand; // haut de la règle de comptage
  const x0 = PAGE.marginX;
  const left = x0 + G.prefix;
  const right = xs[xs.length - 1] + ws[ws.length - 1];
  const rulerBase = y + G.rulerH * 0.72;
  const top = y;
  const rhTop = y + G.rulerH;
  const rhVoice = rhTop + sys.right.length * G.rowH; // bande des nuances de la main droite
  const rhSlurs = rhVoice; // bande des liaisons de la main droite, juste sous ses lignes
  const handY = rhVoice + ps.slurBand.D + ps.voiceBand.D + G.handGap;
  const lhTop = handY + G.handGap;
  const lhVoice = lhTop + sys.left.length * G.rowH;
  const lhSlurs = lhVoice;
  const bottom = lhVoice + ps.slurBand.G + ps.voiceBand.G;

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
  // couleur par octave (option) ; sans palette, une bande grise un couloir sur deux
  const tint = (octave: number) => octaveTint(options.octavePalette, options.octaveMixed, octaveOffset(octave));
  const bandFill = (octave: number, alternate: boolean) => tint(octave)?.band ?? (alternate ? BAND : undefined);
  const tabFill = (octave: number) => tint(octave)?.tab ?? TAB;

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
        if (col.k === 0) {
          return (
            <text key={a} x={xs[ci] + 0.5} y={rulerBase} fontSize={2.6} fontStyle="italic" fill={GREY}>
              {col.label}
            </text>
          );
        }
        // découpages du temps, gravés comme les graduations d'une règle, à mi-hauteur des
        // numéros des temps, comme dans le texte : astérisque, point, virgule
        const x = xs[ci] + 0.9;
        // centrées sur la hauteur des chiffres des temps (hauteur de capitale ≈ 0,7 × 2,6 mm)
        const cy = rulerBase - 0.92;
        // dans le gris clair : les graduations restent moins visibles que les numéros des temps
        // « . » : un point ; « , » : une virgule (un point plus petit, avec sa queue)
        if (col.label === ".") return <circle key={a} cx={x} cy={cy} r={0.3} fill={LIGHT_TEXT} />;
        if (col.label === ",") {
          return (
            <path
              key={a}
              d={`M ${x - 0.22} ${cy} a 0.22 0.22 0 1 1 0.44 0 q 0 0.55 -0.4 0.8 q 0.2 -0.35 0.1 -0.62 z`}
              fill={LIGHT_TEXT}
            />
          );
        }
        // astérisque à trois branches, plus fin que le trait du « . »
        const r = 0.8;
        const arms = [90, 30, -30].map((deg) => {
          const t = (deg * Math.PI) / 180, dx = r * Math.cos(t), dy = r * Math.sin(t);
          return `M ${x - dx} ${cy + dy} L ${x + dx} ${cy - dy}`;
        });
        return <path key={a} d={arms.join(" ")} stroke={LIGHT_TEXT} strokeWidth={0.28} strokeLinecap="round" />;
      })}
      <line x1={left} x2={right} y1={rhTop} y2={rhTop} stroke={LIGHT} strokeWidth={0.25} />
      {/* accords : le nom en haut, les notes ymn empilées dessous, la basse en bas */}
      {sys.chords.map((c, i) => {
        const { notes, name } = chordParts(c.text);
        const x = xs[sys.anchors[c.anchor]] + leadExtra(sys, c.anchor) + 0.5;
        const named = !!name && options.chords !== "notes";
        const stacked = options.chords !== "name" || !name;
        return (
          <g key={"ch" + i}>
            {named && (
              <text x={x} y={chordTop + 3.4} fontSize={3.4} fontWeight={700} fill={INK}>
                {name}
              </text>
            )}
            {stacked &&
              notes.map((n, k) => (
                <text key={k} x={x} y={y - 0.6 - k * G.chordNoteH} fontSize={2.2} fontWeight={600} fill={TAB_TEXT}>
                  {n}
                </text>
              ))}
          </g>
        );
      })}

      <OctaveTabs rows={sys.right} top={rhTop} style={options.octaveStyle} position={options.octavePosition} tabFill={tabFill} />
      <OctaveTabs rows={sys.left} top={lhTop} style={options.octaveStyle} position={options.octavePosition} tabFill={tabFill} />
      {/* fonds des couloirs d'abord : les notes, dessinées ensuite, ne sont jamais recouvertes */}
      {sys.right.map((r, i) => {
        const fill = bandFill(r.octave, rb[i]);
        return fill && <rect key={"bd" + i} x={left} y={rhTop + i * G.rowH} width={right - left} height={G.rowH} fill={fill} />;
      })}
      {sys.left.map((r, i) => {
        const fill = bandFill(r.octave, lb[i]);
        return fill && <rect key={"bg" + i} x={left} y={lhTop + i * G.rowH} width={right - left} height={G.rowH} fill={fill} />;
      })}
      {sys.right.map((r, i) => (
        <Row key={"d" + i} ps={ps} row={r} y={rhTop + i * G.rowH} centered={options.notePosition === "center"} />
      ))}
      <line x1={left} x2={right} y1={handY} y2={handY} stroke={INK} strokeWidth={0.5} />
      {sys.left.map((r, i) => (
        <Row key={"g" + i} ps={ps} row={r} y={lhTop + i * G.rowH} centered={options.notePosition === "center"} />
      ))}
      {/* arpèges : une vaguelette devant l'accord, de sa note la plus grave à la plus aiguë */}
      {sys.arpeggios.map((arp, i) => {
        const attack = (r: SystemRow) => !!r.cells[arp.anchor] && !r.cells[arp.anchor].startsWith("-");
        const ys = [
          ...(arp.hand !== "G" ? sys.right.flatMap((r, k) => (attack(r) ? [rhTop + k * G.rowH] : [])) : []),
          ...(arp.hand !== "D" ? sys.left.flatMap((r, k) => (attack(r) ? [lhTop + k * G.rowH] : [])) : []),
        ];
        if (!ys.length) return null;
        const x = xs[sys.anchors[arp.anchor]] + graceExtra(sys, arp.anchor) + G.arpeggioW / 2 + 0.2;
        return <path key={"arp" + i} d={vwave(x, Math.min(...ys) + 0.5, Math.max(...ys) + G.rowH - 0.5, arp.down)} {...WAVE} />;
      })}

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

      {ps.slurBand.D > 0 && <SlurBand ps={ps} voice={sys.voices.D} top={rhSlurs} />}
      {ps.slurBand.G > 0 && <SlurBand ps={ps} voice={sys.voices.G} top={lhSlurs} />}
      {ps.voiceBand.D > 0 && <VoiceBand ps={ps} voice={sys.voices.D} top={rhVoice + ps.slurBand.D} />}
      {ps.voiceBand.G > 0 && <VoiceBand ps={ps} voice={sys.voices.G} top={lhVoice + ps.slurBand.G} />}
      {ps.pedalBand > 0 && <PedalBand ps={ps} top={bottom} />}
      <Marks ps={ps} />
    </g>
  );
}

/**
 * Extrait gravé, pour illustrer la notice : les systèmes seuls, sans page ni en-tête,
 * recadrés au plus près, précédés de l'ordre de jeu s'il y en a un.
 */
export function Excerpt({ pages, options, scale = 1 }: { pages: Page[]; options: RenderOptions; scale?: number }) {
  const systems = pages.flatMap((p) => p.systems);
  if (!systems.length) return null;
  const pad = 1.5;
  const x0 = PAGE.marginX - pad;
  const x1 = Math.max(...systems.map((ps) => ps.xs[ps.xs.length - 1] + ps.ws[ps.ws.length - 1])) + pad;
  // un extrait tient sur une page ; s'il en déborde, les pages suivantes sont décalées à la suite
  let offset = 0;
  const placed = pages.flatMap((p, i) => {
    if (i) offset += Math.max(...pages[i - 1].systems.map((ps) => ps.y + ps.height)) - Math.min(...p.systems.map((ps) => ps.y)) + G.systemGap;
    return p.systems.map((ps) => ({ ...ps, y: ps.y + offset }));
  });
  const order = pages[0].order;
  const top = Math.min(...placed.map((ps) => ps.y));
  const orderY = top - G.orderH; // l'ordre de jeu, comme en tête de page
  const y0 = (order.length ? orderY : top) - pad;
  const y1 = Math.max(...placed.map((ps) => ps.y + ps.height)) + pad;
  return (
    <svg
      className="excerpt"
      viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`}
      width={`${(x1 - x0) * scale}mm`}
      height={`${(y1 - y0) * scale}mm`}
      fontFamily={FONT}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="#fff" />
      {order.length > 0 && <OrderLine order={order} y={orderY} cx={(x0 + x1) / 2} />}
      {placed.map((ps, i) => (
        <SystemView key={i} ps={ps} options={options} />
      ))}
    </svg>
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
          {meta.subtitle && (
            <text x={PAGE.w / 2} y={PAGE.marginTop + 12} fontSize={3.8} textAnchor="middle" fill={INK}>
              {meta.subtitle}
            </text>
          )}
          {meta.composer && (
            <text x={PAGE.w - PAGE.marginX} y={PAGE.marginTop + 12 + (meta.subtitle ? G.subtitleH : 0)} fontSize={3.4} textAnchor="end" fill={INK}>
              {meta.composer}
            </text>
          )}
          {meta.tempo && (
            <text x={PAGE.marginX} y={PAGE.marginTop + 12 + (meta.subtitle ? G.subtitleH : 0)} fontSize={3.2} fill={INK}>
              {meta.tempo}
            </text>
          )}
        </g>
      )}
      {page.order.length > 0 && <OrderLine order={page.order} y={page.header ? PAGE.marginTop + headerHeight(meta) - 1 : PAGE.marginTop - 2} />}
      {page.systems.map((ps, i) => (
        <SystemView key={i} ps={ps} options={options} />
      ))}
      <text x={PAGE.w / 2} y={PAGE.h - 8} fontSize={2.6} textAnchor="middle" fill={GREY}>
        {page.index + 1} / {total}
      </text>
    </svg>
  );
}
