import { FINGER_MARK, TRILL_MARK, barreOf, numberOf, octaveOffset, pitchClass, stringsOfStaff } from "../../core/index.ts";
import type { Direction, Meta, PedalLine, Shape, SystemRow, Voice } from "../../core/index.ts";
import {
  FINGER,
  METRICS,
  PAGE,
  SLIDE_W,
  bendLabel,
  bendStart,
  chordGrid,
  isPickSign,
  slurH,
  splitChord,
  techniqueOf,
  graceExtra,
  graceSlotW,
  headerHeight,
  leadExtra,
  lyricTextW,
  splitNote,
} from "./engrave.ts";
import type { Page, PlacedSystem } from "./engrave.ts";
import type { OctavePosition, OctaveStyle, RenderOptions } from "../options/options.ts";
import { writtenNames } from "../options/options.ts";
import { octaveTint } from "./colors.ts";
import { player } from "../playback/player.ts";
import { follow } from "./follow.ts";
import { pick } from "./pick.ts";
import "./page.css";
import { textMark } from "./textMark.ts";
import { mainOf, rowLane } from "../../core/locate.ts";
import { keyName, parseKey, prismaKey } from "../../core/key.ts";
import type { Key, NoteNames } from "../../core/index.ts";
import { glide } from "./glide.ts";
import { useEffect, useRef, useSyncExternalStore } from "react";

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

export const FONT = `"Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif`;
/** Nuances en gras italique à empattements, comme sur une partition. */
const DYNAMIC_FONT = `Georgia, "Times New Roman", serif`;
/** Paroles : à empattements, droites, pour ne pas les confondre avec les chiffres des notes. */
const LYRIC_FONT = DYNAMIC_FONT;

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
function OctaveTabs({
  rows,
  top,
  style,
  position,
  tabFill,
  rowH,
  stringName,
}: {
  rows: SystemRow[];
  top: number;
  style: OctaveStyle;
  position: OctavePosition;
  tabFill: (row: SystemRow) => string;
  rowH: number;
  stringName: (string: number) => string;
}) {
  if (rows.some((systemRow) => systemRow.string !== undefined))
    return <StringTabs rows={rows} top={top} tabFill={tabFill} rowH={rowH} stringName={stringName} />;
  const groups: { row: SystemRow; first: number; count: number }[] = [];
  rows.forEach((row, index) => {
    if (row.showOctave || !groups.length) groups.push({ row, first: index, count: 1 });
    else groups[groups.length - 1].count++;
  });
  const x = PAGE.marginX + 0.6;
  const width = METRICS.prefix - 1.4;
  return (
    <g>
      {groups.map((group) => {
        const y = top + group.first * rowH + 0.25;
        const height = group.count * rowH - 0.5;
        return (
          <g key={group.first}>
            <rect x={x} y={y} width={width} height={height} rx={0.6} fill={tabFill(group.row)} />
            <OctaveMark
              cx={x + width / 2}
              cy={position === "top" ? top + group.first * rowH + rowH / 2 : y + height / 2}
              offset={octaveOffset(group.row.octave)}
              style={style}
            />
          </g>
        );
      })}
    </g>
  );
}

/** Onglets d'un instrument à cordes : un par corde, son numéro, puis le nom de la note à vide. */
function StringTabs({
  rows,
  top,
  tabFill,
  rowH,
  stringName,
}: {
  rows: SystemRow[];
  top: number;
  tabFill: (row: SystemRow) => string;
  rowH: number;
  stringName: (string: number) => string;
}) {
  const x = PAGE.marginX + 0.6;
  const width = METRICS.prefix - 1.4;
  return (
    <g>
      {rows.map((systemRow, index) => {
        const y = top + index * rowH + 0.25;
        const cy = top + index * rowH + rowH / 2;
        const name = stringName(systemRow.string!);
        return (
          <g key={index}>
            <rect x={x} y={y} width={width} height={rowH - 0.5} rx={0.6} fill={tabFill(systemRow)} />
            <text x={x + (name ? 1.2 : width / 2)} y={cy + 0.95} fontSize={2.7} fontWeight={600} textAnchor="middle" fill={TAB_TEXT}>
              {systemRow.string}
            </text>
            {name && (
              <text x={x + width - 0.4} y={cy + 0.7} fontSize={1.8} textAnchor="end" fill={TAB_TEXT}>
                {name}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

/**
 * Signes d'articulation d'une note, à la verticale de ses chiffres, en haut de sa ligne,
 * côte à côte : staccato (point), accent (« > »), marcato (« ^ »). cx : milieu des chiffres ;
 * cy : milieu des signes.
 */
/**
 * Une grille d'accord : les cordes debout (la plus grave à gauche), les cases en travers, un point
 * par doigt, un trait pour un barré ; au-dessus, « x » pour une corde qu'on ne joue pas, « o » à
 * vide. Une forme haute commence à sa première case, numérotée à droite ; sinon le sillet, épais.
 */
function ChordGrid({ shape, x, y }: { shape: Shape; x: number; y: number }) {
  const count = shape.length,
    stringGap = METRICS.gridString,
    fretGap = METRICS.gridFret,
    rows = METRICS.gridFrets;
  const pressed = shape.filter((fret): fret is number => !!fret);
  const high = pressed.length ? Math.max(...pressed) : 0;
  const start = high <= rows ? 1 : Math.min(...pressed);
  const top = y + METRICS.gridMarks;
  const right = x + (count - 1) * stringGap;
  const bottom = top + rows * fretGap;
  const barre = barreOf(shape);
  const at = (stringIndex: number) => x + stringIndex * stringGap;
  const mid = (fret: number) => top + (fret - start + 0.5) * fretGap;
  return (
    <g>
      {Array.from({ length: count }, (_, stringIndex) => (
        <line key={"s" + stringIndex} x1={at(stringIndex)} x2={at(stringIndex)} y1={top} y2={bottom} stroke={INK} strokeWidth={0.15} />
      ))}
      {Array.from({ length: rows + 1 }, (_, fretLine) => (
        <line
          key={"f" + fretLine}
          x1={x}
          x2={right}
          y1={top + fretLine * fretGap}
          y2={top + fretLine * fretGap}
          stroke={INK}
          strokeWidth={fretLine === 0 && start === 1 ? 0.6 : 0.15}
        />
      ))}
      {start > 1 && (
        <text x={right + 0.7} y={mid(start) + 0.75} fontSize={2.1} fill={INK}>
          {start}
        </text>
      )}
      {shape.map((fret, stringIndex) =>
        fret === null ? (
          <text key={"m" + stringIndex} x={at(stringIndex)} y={top - 0.45} fontSize={1.7} textAnchor="middle" fill={INK}>
            ×
          </text>
        ) : fret === 0 ? (
          <circle key={"m" + stringIndex} cx={at(stringIndex)} cy={top - 0.85} r={0.42} fill="none" stroke={INK} strokeWidth={0.15} />
        ) : barre && fret === barre.fret && stringIndex >= barre.from ? null : (
          <circle key={"d" + stringIndex} cx={at(stringIndex)} cy={mid(fret)} r={0.52} fill={INK} />
        ),
      )}
      {barre && (
        <rect
          x={at(barre.from) - 0.52}
          y={mid(barre.fret) - 0.52}
          width={at(barre.to) - at(barre.from) + 1.04}
          height={1.04}
          rx={0.52}
          fill={INK}
        />
      )}
    </g>
  );
}

function articulationSigns(signs: string[], cx: number, cy: number) {
  const scale = METRICS.articulationScale;
  return signs.map((sign, index) => {
    const sx = cx + (index - (signs.length - 1) / 2) * METRICS.articulationStep * scale;
    // dessinés autour de (0, 0), puis mis à l'échelle sur place
    const shape =
      sign === "." ? (
        <circle cx={0} cy={0} r={0.3} fill={INK} />
      ) : sign === "!" ? (
        <path d="M -0.42 -0.32 L 0.42 0 L -0.42 0.32" fill="none" stroke={INK} strokeWidth={0.22} />
      ) : sign === "d" ? (
        // médiator vers le bas : le pont (⊓), sa barre plus épaisse
        <path d="M -0.42 0.34 L -0.42 -0.3 L 0.42 -0.3 L 0.42 0.34" fill="none" stroke={INK} strokeWidth={0.24} />
      ) : sign === "u" ? (
        // vers le haut : le V
        <path d="M -0.36 -0.36 L 0 0.34 L 0.36 -0.36" fill="none" stroke={INK} strokeWidth={0.22} />
      ) : (
        <path d="M -0.38 0.32 L 0 -0.38 L 0.38 0.32" fill="none" stroke={INK} strokeWidth={0.26} />
      );
    return (
      <g key={sign} transform={`translate(${sx} ${cy}) scale(${scale})`}>
        {shape}
      </g>
    );
  });
}

function Row({
  ps,
  row,
  y,
  centered,
  articulations,
  reminders,
  techTop,
}: {
  ps: PlacedSystem;
  row: SystemRow;
  y: number;
  centered: boolean;
  articulations?: Map<number, string[]>;
  reminders: boolean;
  techTop: number;
}) {
  const { sys, xs, ws } = ps;
  const base = y + ps.rowH * 0.74;
  // petites notes : en petit, en exposant et en gris foncé, en tête de case, rang par rang
  const graces = row.graces.flatMap((list, anchor) => {
    let x = xs[sys.anchors[anchor]] + 0.4;
    const dy = centered ? row.center[anchor] * ps.rowH : 0;
    return sys.staves[row.staff].graceDigits[anchor].map((digits, slot) => {
      const gx = x;
      x += graceSlotW(digits);
      return list[slot] ? (
        <text key={`g${anchor}-${slot}`} x={gx} y={base + dy - 1.05} fontSize={2.3} fontWeight={600} fill={GRACE}>
          {list[slot]}
        </text>
      ) : null;
    });
  });
  return (
    <g>
      {graces}
      {row.cells.map((cell, anchor) => {
        if (!cell) return null;
        // option « notes centrées » : le bloc de notes est centré dans son couloir
        const dy = centered ? row.center[anchor] * ps.rowH : 0;
        const column = sys.anchors[anchor];
        // la note vient après les petites notes et l'arpège de sa case
        const extra = leadExtra(sys, anchor);
        const x = xs[column] + extra;
        const width = ws[column] - extra;
        const mid = y + dy + ps.rowH / 2;
        // trille : la note, sa voisine en petit, puis un trait ondulé sur toute sa durée
        if (row.trill[anchor] && cell === "-") return <path key={anchor} d={wave(xs[column], x + width, mid)} {...WAVE} />;
        // note annotée : son articulation au-dessus d'elle, la voisine de trille en petit (en haut à
        // droite), le doigt en négatif (en bas à droite)
        const arts = !cell.startsWith("-") ? articulations?.get(anchor) : undefined;
        // sur une corde, une technique : la case (ou « x », « <12> »), puis le glissé ou le bend dessinés
        const tech = row.string !== undefined ? techniqueOf(cell) : undefined;
        if (tech) {
          const top = y + dy;
          const marks: React.ReactNode[] = [];
          // un glissé : un trait penché, montant vers l'aigu, descendant vers le grave ; en tirets
          // quand il vient de rien ou y va, plein quand il va vers la note suivante de la corde
          const slideLine = (key: string, from: number, direction: Direction, toNothing: boolean) => {
            const [ya, yb] = direction === "up" ? [base + dy - 0.2, top + 1.1] : [top + 1.1, base + dy - 0.2];
            marks.push(
              <line
                key={key}
                x1={from + 0.3}
                x2={from + 2.4}
                y1={ya}
                y2={yb}
                stroke={INK}
                strokeWidth={0.4}
                strokeLinecap="round"
                {...(toNothing ? { strokeDasharray: "0.6 0.45" } : {})}
              />,
            );
          };
          if (tech.slideIn) slideLine("in", x + 0.1, tech.slideIn, true);
          const lx = x + 0.5 + (tech.slideIn ? SLIDE_W : 0);
          let end = lx + tech.label.length * METRICS.noteDigit * (tech.harmonic ? 0.8 : 1);
          const art = articulationSigns(arts ?? [], lx + (end - lx) / 2 - 0.15, top - 0.05);
          const after = tech.slide ?? tech.slideOut;
          if (after) {
            slideLine("out", end, after, !tech.slide);
            end += SLIDE_W;
          }
          if (tech.bend !== undefined) {
            // le bend, comme en tablature : une flèche qui part de la case et monte au-dessus des cordes,
            // l'écart au-dessus de sa pointe ; relâché, une flèche qui redescend jusqu'à la corde
            // elle part après la case la plus large de la colonne : elle ne coupe aucun chiffre
            const x1 = x + bendStart(sys.staves[row.staff].rows, anchor),
              x2 = x1 + 2.2,
              tip = techTop + 3.2,
              x3 = x2 + 2.6;
            const up = `M ${Math.min(end + 0.2, x1)} ${mid} L ${x1} ${mid} Q ${x2} ${mid} ${x2} ${tip + 0.9}`;
            const down = `M ${x2 + 0.3} ${tip + 0.4} Q ${x3} ${tip + 0.4} ${x3} ${mid - 1.1}`;
            const head = (px: number, py: number, dir: 1 | -1) =>
              `M ${px - 0.6} ${py + dir * 1} L ${px} ${py} L ${px + 0.6} ${py + dir * 1} Z`;
            marks.push(
              <g key="b">
                {/* un liseré blanc : la flèche reste lisible là où elle croise une corde */}
                <path d={up + (tech.release ? " " + down : "")} fill="none" stroke="#fff" strokeWidth={1} />
                <path d={up} fill="none" stroke={INK} strokeWidth={0.32} />
                <path d={head(x2, tip, 1)} fill={INK} />
                {/* l'écart, à partir de la pointe : il laisse la place au médiator, au-dessus de la case */}
                <text x={x2 - 0.7} y={techTop + 2.4} fontSize={2.6} fontWeight={700} fill={INK}>
                  {bendLabel(tech.bend - tech.fret)}
                </text>
                {tech.release && (
                  <g>
                    <path d={down} fill="none" stroke={INK} strokeWidth={0.32} />
                    <path d={head(x3, mid - 0.4, -1)} fill={INK} />
                  </g>
                )}
              </g>,
            );
            end = (tech.release ? x3 : x2) + 0.8;
          }
          const fx = end + FINGER.gap + FINGER.r;
          return (
            <g key={anchor}>
              <text x={lx} y={base + dy} fontSize={tech.harmonic ? 2.8 : 3.3} fontWeight={600} fill={INK}>
                {tech.label}
              </text>
              {art}
              {marks}
              {tech.finger && (
                <g>
                  <rect x={fx - FINGER.r} y={base + dy - 1.95} width={2 * FINGER.r} height={2.9} rx={0.6} fill={TAB_TEXT} />
                  <text x={fx} y={base + dy + 0.3} fontSize={2.2} fontWeight={700} textAnchor="middle" fill="#fff">
                    {tech.finger}
                  </text>
                </g>
              )}
            </g>
          );
        }
        if (!cell.startsWith("-") && (cell.includes(TRILL_MARK) || cell.includes(FINGER_MARK) || arts)) {
          const { main, aux, finger } = splitNote(cell);
          let end = x + 0.5 + main.length * METRICS.noteDigit;
          // au-dessus des chiffres, à cheval sur le haut de la ligne : assez d'air pour rester lisible
          const art = articulationSigns(arts ?? [], x + 0.5 + (main.length * METRICS.noteDigit) / 2 - 0.15, y + dy - 0.05);
          const auxX = end + 0.35;
          if (aux) end = auxX + aux.length * 1.25;
          const fx = end + FINGER.gap + FINGER.r;
          if (finger) end = fx + FINGER.r;
          return (
            <g key={anchor}>
              <text x={x + 0.5} y={base + dy} fontSize={3.3} fontWeight={600} fill={INK}>
                {main}
              </text>
              {art}
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
              {aux && end + 0.3 < x + width && <path d={wave(end + 0.3, x + width, mid)} {...WAVE} />}
            </g>
          );
        }
        if (row.trill[anchor]) {
          // trille commencée au système précédent : le rappel « –N », puis l'ondulation
          const end = x + 0.5 + cell.length * METRICS.noteDigit;
          return (
            <g key={anchor}>
              <text x={x + 0.5} y={base + dy} fontSize={3.1} fill={GREY}>
                {"–" + cell.slice(1)}
              </text>
              {end < x + width && <path d={wave(end, x + width, mid)} {...WAVE} />}
            </g>
          );
        }
        // sans rappel (option), une note commencée au système précédent n'est qu'un trait de tenue
        if (cell === "-" || (cell.startsWith("-") && !reminders)) {
          return (
            <line
              key={anchor}
              x1={x + width * 0.22}
              x2={x + width * 0.62}
              y1={y + dy + ps.rowH / 2}
              y2={y + dy + ps.rowH / 2}
              stroke={INK}
              strokeWidth={0.32}
            />
          );
        }
        if (cell.startsWith("-")) {
          // note commencée au système précédent : le trait de tenue habituel, puis en petit et en
          // gris le rappel de la note tenue (« — 8 »), pour ne pas le lire comme un nombre négatif
          const y1 = y + dy + ps.rowH / 2;
          const x1 = x + 0.5,
            x2 = x1 + METRICS.holdW;
          return (
            <g key={anchor}>
              <line x1={x1} x2={x2} y1={y1} y2={y1} stroke={INK} strokeWidth={0.32} />
              <text x={x2 + 0.6} y={base + dy - 0.2} fontSize={2.7} fontWeight={600} fill={GREY}>
                {cell.slice(1)}
              </text>
            </g>
          );
        }
        return (
          <text key={anchor} x={x + 0.5} y={base + dy} fontSize={3.3} fontWeight={600} fill={INK}>
            {cell}
          </text>
        );
      })}
    </g>
  );
}

/** Trait ondulé horizontal (trille) de x1 à x2, centré sur y. */
function wave(x1: number, x2: number, y: number): string {
  const period = 1.3,
    amp = 0.35;
  let path = `M ${x1} ${y}`;
  for (let x = x1, index = 0; x < x2 - 0.01; x += period / 2, index++) {
    const nx = Math.min(x + period / 2, x2);
    path += ` Q ${(x + nx) / 2} ${y + (index % 2 ? amp : -amp) * 2} ${nx} ${y}`;
  }
  return path;
}

/** Vaguelette verticale (arpège) de y1 à y2, centrée sur x ; down : flèche vers le bas. */
function vwave(x: number, y1: number, y2: number, down: boolean): string {
  const period = 1.3,
    amp = 0.35;
  let path = `M ${x} ${y1}`;
  for (let y = y1, index = 0; y < y2 - 0.01; y += period / 2, index++) {
    const ny = Math.min(y + period / 2, y2);
    path += ` Q ${x + (index % 2 ? amp : -amp) * 2} ${(y + ny) / 2} ${x} ${ny}`;
  }
  if (down) path += ` M ${x - 0.7} ${y2 - 0.9} L ${x} ${y2} L ${x + 0.7} ${y2 - 0.9}`;
  return path;
}

const WAVE = { fill: "none", stroke: INK, strokeWidth: 0.3, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

/**
 * Liaisons d'une portée : un arc fin, creux vers le haut comme une liaison sous les notes, de
 * la première note à la dernière. Une liaison coupée reste ouverte au bord du système.
 */
function SlurBand({ ps, voice, rows, top }: { ps: PlacedSystem; voice: Voice; rows: SystemRow[]; top: number }) {
  const { sys, xs, ws } = ps;
  const left = PAGE.marginX + METRICS.prefix;
  const right = xs[xs.length - 1] + ws[ws.length - 1];
  const noteX = (anchor: number) => xs[sys.anchors[anchor]] + leadExtra(sys, anchor) + 1.4;
  // sur une corde, deux notes liées l'une après l'autre : un hammer-on (H) si la seconde est plus
  // haute sur la corde, un pull-off (P) si elle est plus basse ; la lettre sous la liaison, entre elles
  const letters: { x: number; text: string }[] = [];
  const fret = (cell: string) => (cell && !cell.startsWith("-") ? Number(cell.match(/\d+/)?.[0] ?? NaN) : NaN);
  for (const slurSpan of voice.slurs) {
    for (const row of rows.filter((candidate) => candidate.string !== undefined)) {
      let prev: { anchor: number; fret: number } | undefined;
      for (let anchor = slurSpan.opens ? slurSpan.fromAnchor : 0; anchor <= (slurSpan.closes ? slurSpan.toAnchor : sys.anchors.length - 1); anchor++) {
        const played = fret(row.cells[anchor] ?? "");
        if (Number.isNaN(played)) continue;
        if (prev && played !== prev.fret) letters.push({ x: (noteX(prev.anchor) + noteX(anchor)) / 2, text: played > prev.fret ? "H" : "P" });
        prev = { anchor, fret: played };
      }
    }
  }
  const letterY = top + slurH(voice) + 1.5;
  return (
    <g>
      {letters.map((letter, index) => (
        <text key={"hp" + index} x={letter.x} y={letterY} fontSize={2.7} fontWeight={700} textAnchor="middle" fill={INK}>
          {letter.text}
        </text>
      ))}
      {voice.slurs.map((slurSpan, index) => {
        const x1 = slurSpan.opens ? noteX(slurSpan.fromAnchor) : left;
        const x2 = slurSpan.closes ? noteX(slurSpan.toAnchor) : right;
        const y = top + 0.5 + slurSpan.level * METRICS.slurLevel;
        const depth = Math.min(1.1, 0.45 + (x2 - x1) * 0.02); // creux, un peu plus marqué pour une longue liaison
        const mx = (x1 + x2) / 2;
        return <path key={index} d={`M ${x1} ${y} Q ${mx} ${y + 2 * depth} ${x2} ${y} Q ${mx} ${y + 2 * depth - 0.7} ${x1} ${y} Z`} fill={INK} />;
      })}
    </g>
  );
}

type BarCol = Extract<PlacedSystem["sys"]["columns"][number], { kind: "barSep" }>;

/**
 * Barre entre deux sections à la suite : la fin de la section (double barre, ou « :|| »), un
 * blanc, puis le début de la suivante, ouverte comme une ligne (trait, ou « ||: »).
 */
function spacedWidths(col: BarCol, x: number, width: number) {
  const close = METRICS.barSep + (col.endRepeat ? METRICS.repeatDots : 0);
  const open = col.startRepeat ? METRICS.repeatDots + METRICS.beatSep : 0;
  return { close, open, gap: [x + close, x + width - open] as [number, number] };
}

/**
 * Barre de mesure, avec ses signes de reprise : « :|| » (points, trait fin, trait épais),
 * « ||: » (trait épais, trait fin, points). Les points sont placés au milieu de chaque portée.
 */
function BarLine({
  x,
  width,
  column,
  top,
  bottom,
  sections,
  end,
}: {
  x: number;
  width: number;
  column: BarCol;
  top: number;
  bottom: number;
  sections: number[][];
  end: boolean;
}) {
  const thin = (lx: number, key: string) => <line key={key} x1={lx} x2={lx} y1={top} y2={bottom} stroke={INK} strokeWidth={0.22} />;
  const thick = (lx: number, key: string) => <line key={key} x1={lx} x2={lx} y1={top} y2={bottom} stroke={INK} strokeWidth={0.6} />;
  const dots = (dx: number, key: string) =>
    sections.map(([from, to], index) => {
      const mid = (from + to) / 2;
      return (
        <g key={key + index}>
          <circle cx={dx} cy={mid - 0.95} r={0.38} fill={INK} />
          <circle cx={dx} cy={mid + 0.95} r={0.38} fill={INK} />
        </g>
      );
    });
  // les points sont centrés dans la place qui leur est réservée (METRICS.repeatDots)
  const dotOffset = METRICS.repeatDots / 2;
  if (column.spaced) {
    const { close, open, gap } = spacedWidths(column, x, width);
    const sub = { top, bottom, sections, end: true };
    return (
      <g>
        <BarLine x={x} width={close} column={{ kind: "barSep", endRepeat: column.endRepeat, section: !column.endRepeat }} {...sub} />
        <line x1={gap[1]} x2={gap[1]} y1={top} y2={bottom} stroke={INK} strokeWidth={0.45} />
        {open > 0 && <BarLine x={gap[1]} width={open} column={{ kind: "barSep", lead: true }} {...sub} />}
      </g>
    );
  }
  if (column.lead)
    return (
      <g>
        {thin(x + 0.55, "t")}
        {dots(x + width - dotOffset, "d")}
      </g>
    );
  if (!column.endRepeat && !column.startRepeat) {
    // fin du morceau : double barre, trait fin puis trait épais
    if (column.final)
      return (
        <g>
          {thin(x + width - 1.1, "t")}
          {thick(x + width - 0.3, "T")}
        </g>
      );
    // en fin de système, la barre ferme les couloirs : elle s'aligne sur leur bord droit
    // début de section : double barre
    if (column.section) {
      // aussi marquée qu'une barre de mesure : deux traits de même épaisseur
      const bar = (lx: number, key: string) => <line key={key} x1={lx} x2={lx} y1={top} y2={bottom} stroke={INK} strokeWidth={0.4} />;
      const middle = end ? x + width - 0.65 : x + width / 2;
      return (
        <g>
          {bar(middle - 0.45, "t1")}
          {bar(middle + 0.45, "t2")}
        </g>
      );
    }
    const lx = end ? x + width - 0.225 : x + width / 2;
    return <line x1={lx} x2={lx} y1={top} y2={bottom} stroke={INK} strokeWidth={0.45} />;
  }
  if (column.endRepeat && column.startRepeat) {
    const middle = x + width / 2;
    return (
      <g>
        {dots(x + dotOffset, "a")}
        {thin(middle - 0.75, "t1")}
        {thick(middle, "T")}
        {thin(middle + 0.75, "t2")}
        {dots(x + width - dotOffset, "b")}
      </g>
    );
  }
  if (column.endRepeat)
    return (
      <g>
        {dots(x + dotOffset, "a")}
        {thin(x + width - 1.1, "t")}
        {thick(x + width - 0.3, "T")}
      </g>
    );
  return (
    <g>
      {thick(x + 0.45, "T")}
      {thin(x + 1.25, "t")}
      {dots(x + width - dotOffset, "b")}
    </g>
  );
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
  const left = PAGE.marginX + METRICS.prefix;
  const ax = (anchor: number) => xs[sys.anchors[anchor]];
  const anchorEnd = (anchor: number) => xs[sys.anchors[anchor]] + ws[sys.anchors[anchor]];
  const textY = ps.y + METRICS.markH * 0.72;
  const top = ps.y + ps.textBand + 0.35; // haut de la bande de structure
  return (
    <g>
      {sys.marks
        .filter((mark) => mark.kind === "text")
        .map((mark, index) => (
          <text key={"t" + index} x={ax(mark.anchor!) + 0.5} y={textY} fontSize={2.9} fontStyle="italic" fill={INK}>
            {mark.text}
          </text>
        ))}
      {/* début de section : sa lettre contre la barre qui l'ouvre */}
      {sys.marks
        .filter((mark) => mark.kind === "marker")
        .map((mark, index) => {
          const barColumn = mark.column! >= 0 ? (sys.columns[mark.column!] as BarCol) : undefined;
          // en cours de ligne, contre la barre qui ouvre la section (après le blanc, s'il y en a un)
          const bar = !barColumn ? left : barColumn.spaced ? spacedWidths(barColumn, xs[mark.column!], ws[mark.column!]).gap[1] : xs[mark.column!] + ws[mark.column!] / 2;
          return <SectionBox key={"r" + index} x={bar + 0.6} y={top} label={mark.label!} />;
        })}
      {sys.marks
        .filter((mark) => mark.kind === "fermata")
        .map((mark, index) => (
          <Fermata key={"f" + index} cx={ax(mark.anchor!) + leadExtra(sys, mark.anchor!) + 1.4} y={top} />
        ))}
      {sys.marks
        .filter((mark) => mark.kind === "times")
        .map((mark, index) => (
          <text key={"x" + index} x={anchorEnd(mark.anchor!) - 0.4} y={top + 2.55} fontSize={2.6} fontWeight={700} textAnchor="end" fill={INK}>
            {mark.text}
          </text>
        ))}
    </g>
  );
}

/** Ordre de jeu des sections, en tête de page : les mêmes lettres que sur la partition. */
export function OrderLine({ order, y, cx = PAGE.w / 2, live = false }: { order: string[]; y: number; cx?: number; live?: boolean }) {
  const step = 3.6 + 1.6;
  const x0 = cx - (order.length * step - 1.6) / 2;
  return (
    <g>
      {live && <OrderPlaying x0={x0} step={step} y={y} />}
      {order.map((label, index) => (
        <SectionBox key={index} x={x0 + index * step} y={y} label={label} />
      ))}
      {live && (
        <g className="seek">
          {order.map((label, index) => (
            <rect
              key={index}
              x={x0 + index * step - 0.8}
              y={y - 0.8}
              width={step}
              height={4.9}
              fill="transparent"
              className="cursor-pointer"
              onClick={() => player.seekEntry(index)}
            >
              <title>{`Écouter à partir de cette section ${label}`}</title>
            </rect>
          ))}
        </g>
      )}
    </g>
  );
}

/**
 * Sur la page, l'ordre de jeu sert aussi à l'écoute : la section jouée y est entourée (on sait
 * ainsi quel passage d'une section répétée on écoute), et un clic sur une lettre y lance la lecture.
 */
function OrderPlaying({ x0, step, y }: { x0: number; step: number; y: number }) {
  const { entry } = useSyncExternalStore(player.subscribe, player.getSnapshot);
  if (entry === null) return null;
  return <rect x={x0 + entry * step - 0.8} y={y - 0.8} width={5.2} height={4.9} rx={0.9} fill="rgb(255, 200, 70)" />;
}

/**
 * Paroles d'une portée : un couplet par ligne, chaque syllabe sous le début de sa note. Un
 * trait d'union relie les syllabes d'un mot ; un trait bas prolonge une syllabe chantée sur
 * plusieurs notes (mélisme), jusqu'à la fin de la dernière.
 */
function LyricBand({ ps, voice, top }: { ps: PlacedSystem; voice: Voice; top: number }) {
  const { sys, xs, ws } = ps;
  const left = PAGE.marginX + METRICS.prefix;
  const right = xs[xs.length - 1] + ws[ws.length - 1];
  const sx = (anchor: number) => xs[sys.anchors[anchor]] + leadExtra(sys, anchor) + 0.5;
  const anchorEnd = (anchor: number) => xs[sys.anchors[anchor]] + ws[sys.anchors[anchor]];
  const halo = { stroke: "#fff", strokeWidth: 0.6, paintOrder: "stroke" as const, strokeLinejoin: "round" as const };
  return (
    <g>
      {voice.lyrics.map((line, verse) => {
        const base = top + 0.4 + verse * METRICS.lyricH + METRICS.lyricH * 0.68;
        return (
          <g key={verse}>
            {line.syllables.map((syllable, index) => {
              const end = sx(syllable.anchor) + lyricTextW(syllable.text);
              const next = line.syllables[index + 1];
              // trait d'union : au milieu de l'espace jusqu'à la syllabe suivante, ou juste après en fin de système
              const gap = next ? sx(next.anchor) - end : 1.8;
              const hw = Math.min(0.8, gap * 0.4);
              const hx = end + gap / 2;
              return (
                <g key={index}>
                  <text x={sx(syllable.anchor)} y={base} fontFamily={LYRIC_FONT} fontSize={3.1} fill={INK} {...halo}>
                    {syllable.text}
                  </text>
                  {syllable.hyphen && <line x1={hx - hw / 2} x2={hx + hw / 2} y1={base - 0.9} y2={base - 0.9} stroke={INK} strokeWidth={0.22} />}
                </g>
              );
            })}
            {line.extenders.map((extender, index) => {
              const syl = extender.opens ? line.syllables.find((syllable) => syllable.anchor === extender.fromAnchor) : undefined;
              const x1 = syl ? sx(extender.fromAnchor) + lyricTextW(syl.text) + 0.3 : left;
              const x2 = extender.closes ? anchorEnd(extender.toAnchor) - 0.8 : right;
              return x2 > x1 ? (
                <line key={"e" + index} x1={x1} x2={x2} y1={base + 0.35} y2={base + 0.35} stroke={INK} strokeWidth={0.25} />
              ) : null;
            })}
          </g>
        );
      })}
    </g>
  );
}

/** Largeur estimée d'une indication gravée : une nuance (gras italique), ou un texte. */
const markW = (text: string, kind: string) => [...text].length * (kind === "dynamic" ? 2.1 : 1.35) + 0.9;

/**
 * Bande des nuances d'une portée : nuances (p, mf…), textes (cresc., dolce…) et soufflets.
 * Un soufflet coupé par un changement de système garde son ouverture au point de coupure.
 */
function VoiceBand({ ps, voice, top }: { ps: PlacedSystem; voice: Voice; top: number }) {
  const { sys, xs, ws } = ps;
  const ax = (anchor: number) => xs[sys.anchors[anchor]];
  const anchorEnd = (anchor: number) => xs[sys.anchors[anchor]] + ws[sys.anchors[anchor]];
  const cy = top + METRICS.voiceH / 2;
  const base = top + METRICS.voiceH * 0.7;
  const open = 0.95; // demi-ouverture maximale d'un soufflet
  // halo blanc : le texte reste lisible quand il traverse une séparation de temps
  const halo = { stroke: "#fff", strokeWidth: 0.6, paintOrder: "stroke" as const, strokeLinejoin: "round" as const };
  return (
    <g>
      {/* l'étouffé de la paume : « P.M. » puis un trait pointillé jusqu'à sa fin, fermé d'un crochet ; le vibrato : une ondulation */}
      {voice.effects.map((effectSpan, index) => {
        const x1 = ax(effectSpan.fromAnchor) + 0.5;
        const x2 = anchorEnd(effectSpan.toAnchor) - 0.6;
        if (effectSpan.kind === "vibrato") return <path key={"e" + index} d={wave(x1, x2, cy)} {...WAVE} />;
        const label = effectSpan.opens ? "P.M." : "(P.M.)";
        const lx = x1 + label.length * 1.45 + 0.5;
        return (
          <g key={"e" + index}>
            <text x={x1} y={base} fontSize={2.9} fontWeight={700} fill={INK}>
              {label}
            </text>
            {lx < x2 && <line x1={lx} x2={x2} y1={cy} y2={cy} stroke={INK} strokeWidth={0.24} strokeDasharray="0.7 0.5" />}
            {effectSpan.closes && <line x1={x2} x2={x2} y1={cy - 0.9} y2={cy} stroke={INK} strokeWidth={0.24} />}
          </g>
        );
      })}
      {voice.hairpins.map((hairpinSpan, index) => {
        const x1 = ax(hairpinSpan.fromAnchor) + (hairpinSpan.from === 0 ? 0.5 : 0);
        const x2 = anchorEnd(hairpinSpan.toAnchor) - (hairpinSpan.to === 1 ? 0.6 : 0);
        const size = (fraction: number) => (hairpinSpan.kind === "<" ? fraction : 1 - fraction) * open;
        const startOpening = size(hairpinSpan.from),
          endOpening = size(hairpinSpan.to);
        return (
          <path
            key={"h" + index}
            d={`M ${x2} ${cy - endOpening} L ${x1} ${cy - startOpening} ${startOpening === 0 ? "" : `M ${x1} ${cy + startOpening}`} L ${x2} ${cy + endOpening}`}
            fill="none"
            stroke={INK}
            strokeWidth={0.28}
            strokeLinejoin="round"
          />
        );
      })}
      {voice.marks.map((voiceMark, index) => {
        // l'arpège et les articulations se dessinent sur l'accord (voir SystemView), pas dans cette bande
        if (voiceMark.kind === "arpeggio" || voiceMark.kind === "articulation") return null;
        // plusieurs indications sur une même case (« pp » puis « con sordina ») : à la suite
        const before = voice.marks.slice(0, index).filter((other) => other.anchor === voiceMark.anchor && other.kind !== "arpeggio" && other.kind !== "articulation");
        const x = ax(voiceMark.anchor) + before.reduce((total, other) => total + markW(other.text, other.kind) + 1, 0);
        return voiceMark.kind === "dynamic" ? (
          <text
            key={"m" + index}
            x={x + 0.9}
            y={base}
            fontFamily={DYNAMIC_FONT}
            fontSize={3.6}
            fontWeight={700}
            fontStyle="italic"
            fill={INK}
            {...halo}
          >
            {voiceMark.text}
          </text>
        ) : (
          <text key={"m" + index} x={x + 0.7} y={base} fontSize={2.8} fontStyle="italic" fill={INK} {...halo}>
            {voiceMark.text}
          </text>
        );
      })}
    </g>
  );
}

/**
 * Pédale : trait sous le système, comme sur les partitions modernes. Il commence par un
 * crochet là où la pédale s'enfonce, finit par un crochet là où elle se relâche, et
 * marque d'une pointe chaque changement. Sa longueur montre exactement ce qui est tenu.
 */
function PedalBand({ ps, pedal, top }: { ps: PlacedSystem; pedal: PedalLine; top: number }) {
  const { sys, xs, ws } = ps;
  const left = PAGE.marginX + METRICS.prefix;
  const right = xs[xs.length - 1] + ws[ws.length - 1];
  const y = top + METRICS.pedalH * 0.7;
  const hook = 1.5; // hauteur des crochets et des pointes
  const notch = 0.8; // demi-largeur d'une pointe de changement
  const px = (anchor: number) => xs[sys.anchors[anchor]] + 0.3;
  const written: string[] = [],
    implied: string[] = [];
  for (const span of pedal.spans) {
    const paths = span.implied ? implied : written;
    let x1 = span.fromAnchor >= 0 ? px(span.fromAnchor) : left;
    let x2 = span.toAnchor >= 0 ? px(span.toAnchor) : right;
    if (span.changeStart) {
      // pointe du changement, dessinée une seule fois, par la pédale qui commence
      paths.push(`M ${x1 - notch} ${y} L ${x1} ${y - hook} L ${x1 + notch} ${y}`);
      x1 += notch;
    } else if (span.opens) paths.push(`M ${x1} ${y - hook} L ${x1} ${y}`);
    // un changement en fin de système se dessine au début du système suivant
    if (span.changeEnd && span.toAnchor >= 0) x2 -= notch;
    paths.push(`M ${x1} ${y} L ${x2} ${y}`);
    if (span.closes && !span.changeEnd) paths.push(`M ${x2} ${y} L ${x2} ${y - hook}`);
  }
  return (
    <g>
      <text x={PAGE.marginX + METRICS.prefix - 1.2} y={y} fontSize={2.3} fill={GREY} textAnchor="end" fontStyle="italic">
        Ped.
      </text>
      <path d={written.join(" ")} fill="none" stroke={INK} strokeWidth={0.3} strokeLinejoin="round" />
      {/* pédales déduites d'un « Ped. simile », atténuées */}
      {implied.length > 0 && <path d={implied.join(" ")} fill="none" stroke={LIGHT} strokeWidth={0.3} strokeLinejoin="round" />}
      {/* consignes (« Ped. simile ») : sur la ligne de pédale, après un éventuel crochet */}
      {pedal.texts.map((pedalText, index) => (
        <text key={index} x={px(pedalText.anchor) + 0.8} y={y} fontSize={2.8} fontStyle="italic" fill={INK}>
          {pedalText.text}
        </text>
      ))}
    </g>
  );
}

/**
 * Accolade fine à gauche d'une partie à plusieurs portées (le piano), de top à bottom.
 * Une accolade classique : deux courbes qui se rejoignent en pointe au milieu.
 */
function Brace({ x, top, bottom }: { x: number; top: number; bottom: number }) {
  const mid = (top + bottom) / 2,
    width = 1.3;
  const outline = [
    `M ${x} ${top}`,
    `C ${x - width} ${top + 1}, ${x} ${mid - 1.5}, ${x - width} ${mid}`,
    `C ${x} ${mid + 1.5}, ${x - width} ${bottom - 1}, ${x} ${bottom}`,
    `C ${x - width * 0.6} ${bottom - 1}, ${x + 0.25} ${mid + 1.5}, ${x - width} ${mid}`,
    `C ${x + 0.25} ${mid - 1.5}, ${x - width * 0.6} ${top + 1}, ${x} ${top}`,
  ].join(" ");
  return <path d={outline} fill={INK} stroke={INK} strokeWidth={0.1} />;
}

export function SystemView({ ps: placed, options, names }: { ps: PlacedSystem; options: RenderOptions; names: boolean }) {
  // la disposition verticale est calculée depuis le haut du système : on la place sur la page
  const systemY = placed.y;
  const ps = {
    ...placed,
    rulerTop: systemY + placed.rulerTop,
    staves: placed.staves.map((staffPlace) => ({
      ...staffPlace,
      separator: staffPlace.separator === undefined ? undefined : systemY + staffPlace.separator,
      techTop: systemY + staffPlace.techTop,
      rowsTop: systemY + staffPlace.rowsTop,
      slurTop: systemY + staffPlace.slurTop,
      lyricTop: systemY + staffPlace.lyricTop,
      voiceTop: systemY + staffPlace.voiceTop,
      pedalTop: systemY + staffPlace.pedalTop,
      bottom: systemY + staffPlace.bottom,
    })),
    parts: placed.parts.map((part) => ({ ...part, top: systemY + part.top, bottom: systemY + part.bottom })),
  };
  const { sys, xs, ws } = ps;
  const chordTop = ps.y + ps.textBand + ps.structBand; // bande des accords, juste au-dessus de la règle
  const y = ps.rulerTop; // haut de la règle de comptage
  const x0 = PAGE.marginX;
  const left = x0 + METRICS.prefix;
  const right = xs[xs.length - 1] + ws[ws.length - 1];
  const rulerBase = y + METRICS.rulerH * 0.72;
  // sections à la suite : le blanc entre la fin d'une section et la suivante coupe les couloirs
  const gaps = sys.columns.flatMap((column, index) => (column.kind === "barSep" && column.spaced ? [spacedWidths(column, xs[index], ws[index]).gap] : []));
  const spans = (start: number, end: number) => {
    const out: [number, number][] = [];
    let from = start;
    for (const [g0, g1] of gaps) {
      out.push([from, g0]);
      from = g1;
    }
    out.push([from, end]);
    return out;
  };
  const rowY = (staff: number, index: number) => ps.staves[staff].rowsTop + index * ps.rowH;

  // bandes alternées par groupe d'octave, dans chaque portée
  const alternate = (rows: SystemRow[]) => {
    let group = -1;
    return rows.map((systemRow) => {
      if (systemRow.showOctave || systemRow.string !== undefined) group++;
      return group % 2 === 1;
    });
  };
  // couleur par octave (option), ou par corde, chacune la sienne ; sans palette, une bande grise un couloir sur deux
  const tint = (row: SystemRow) => octaveTint(options.octaveColors, row.string !== undefined ? 4 - row.string : octaveOffset(row.octave));
  const bandFill = (row: SystemRow, alt: boolean) => tint(row)?.band ?? (alt ? BAND : undefined);
  const tabFill = (row: SystemRow) => tint(row)?.tab ?? TAB;
  // le nom d'une corde, celui de sa note à vide dans l'accordage (le capo n'y change rien, comme
  // pour le guitariste), selon l'option des noms de notes
  const stringName = (staff: number) => (string: number) => {
    const strings = stringsOfStaff(sys.parts, staff);
    const names = writtenNames(options.noteNames);
    return strings && names !== "none" ? pitchClass(numberOf(strings.open[string - 1]), names) : "";
  };
  const centered = options.notePosition === "center";
  // articulations de chaque portée : portées par sa note la plus aiguë attaquée dans la case (une fois pour l'accord)
  const articulationsOf = (staff: number, index: number) => {
    const systemStaff = sys.staves[staff];
    const out = new Map<number, string[]>();
    for (const voiceMark of systemStaff.voice.marks) {
      if (voiceMark.kind !== "articulation" || isPickSign(voiceMark.text)) continue;
      const top = systemStaff.rows.findIndex((systemRow) => !!systemRow.cells[voiceMark.anchor] && !systemRow.cells[voiceMark.anchor].startsWith("-"));
      if (top === index) out.set(voiceMark.anchor, [...(out.get(voiceMark.anchor) ?? []), voiceMark.text]);
    }
    return out;
  };

  return (
    <g>
      {/* numéro de la première mesure, préfixé de « m » pour ne pas le confondre avec les temps */}
      <text x={x0 + METRICS.prefix - 1.2} y={rulerBase} fontSize={2.3} fill={GREY} textAnchor="end" fontStyle="italic">
        {"m" + sys.bar}
      </text>
      {/* règle de comptage */}
      {sys.anchors.map((columnIndex, anchor) => {
        const column = sys.columns[columnIndex];
        if (column.kind !== "anchor" || !column.label) return null;
        if (column.cellIndex === 0) {
          return (
            <text key={anchor} x={xs[columnIndex] + 0.5} y={rulerBase} fontSize={2.6} fontStyle="italic" fill={GREY}>
              {column.label}
            </text>
          );
        }
        // découpages du temps, gravés comme les graduations d'une règle, à mi-hauteur des
        // numéros des temps, comme dans le texte : astérisque, point, virgule
        const x = xs[columnIndex] + 0.9;
        // centrées sur la hauteur des chiffres des temps (hauteur de capitale ≈ 0,7 × 2,6 mm)
        const cy = rulerBase - 0.92;
        // dans le gris clair : les graduations restent moins visibles que les numéros des temps
        // « . » : un point ; « , » : une virgule (un point plus petit, avec sa queue)
        if (column.label === ".") return <circle key={anchor} cx={x} cy={cy} r={0.3} fill={LIGHT_TEXT} />;
        if (column.label === ",") {
          return (
            <path key={anchor} d={`M ${x - 0.22} ${cy} a 0.22 0.22 0 1 1 0.44 0 q 0 0.55 -0.4 0.8 q 0.2 -0.35 0.1 -0.62 z`} fill={LIGHT_TEXT} />
          );
        }
        // astérisque à trois branches, plus fin que le trait du « . »
        const radius = 0.8;
        const arms = [90, 30, -30].map((deg) => {
          const angle = (deg * Math.PI) / 180,
            dx = radius * Math.cos(angle),
            dy = radius * Math.sin(angle);
          return `M ${x - dx} ${cy + dy} L ${x + dx} ${cy - dy}`;
        });
        return <path key={anchor} d={arms.join(" ")} stroke={LIGHT_TEXT} strokeWidth={0.28} strokeLinecap="round" />;
      })}
      {spans(left, right).map(([from, to], innerIndex) => (
        <line key={"rl" + innerIndex} x1={from} x2={to} y1={y + METRICS.rulerH} y2={y + METRICS.rulerH} stroke={LIGHT} strokeWidth={0.25} />
      ))}
      {/* accords : le nom en haut, les notes Prisma empilées dessous, la basse en bas ; ou la grille sous le nom */}
      {sys.chords.map((chord, index) => {
        const { notes, name } = splitChord(chord.text, options.chordNames);
        const x = xs[sys.anchors[chord.anchor]] + leadExtra(sys, chord.anchor) + 0.5;
        const named = !!name && options.chords !== "notes";
        const grid = options.chords === "grid" ? chordGrid(chord.text, sys.parts) : undefined;
        const stacked = !grid && (options.chords === "notes" || options.chords === "both" || !name);
        return (
          <g key={"ch" + index}>
            {named && (
              <text x={x} y={chordTop + 3.4} fontSize={3.4} fontWeight={700} fill={INK}>
                {name}
              </text>
            )}
            {grid && <ChordGrid shape={grid} x={x + 0.3} y={chordTop + (named ? METRICS.chordNameH : 0.8)} />}
            {stacked &&
              notes.map((note, noteIndex) => (
                <text key={noteIndex} x={x} y={y - 0.6 - noteIndex * METRICS.chordNoteH} fontSize={2.2} fontWeight={600} fill={TAB_TEXT}>
                  {note}
                </text>
              ))}
          </g>
        );
      })}

      {/* instruments : une accolade pour plusieurs parties, le nom au premier système */}
      {ps.parts.map((part, index) => {
        const multi = part.last > part.first;
        const top = ps.staves[part.first].rowsTop,
          bottom = ps.staves[part.last].voiceTop + ps.staves[part.last].voiceBand;
        return (
          <g key={"in" + index}>
            {multi && bottom > top && <Brace x={x0 - 0.3} top={top} bottom={bottom} />}
            {names && part.name && (
              <text x={x0 - (multi ? 2.2 : 0.8)} y={(top + bottom) / 2 + 1} fontSize={2.8} fontStyle="italic" textAnchor="end" fill={INK}>
                {part.name}
              </text>
            )}
          </g>
        );
      })}

      {sys.staves.map((systemStaff, staff) => (
        <OctaveTabs
          key={"ot" + staff}
          rows={systemStaff.rows}
          top={ps.staves[staff].rowsTop}
          style={options.octaveStyle}
          position={options.octavePosition}
          tabFill={tabFill}
          rowH={ps.rowH}
          stringName={stringName(staff)}
        />
      ))}
      {/* fonds des couloirs d'abord : les notes, dessinées ensuite, ne sont jamais recouvertes */}
      {sys.staves.map((systemStaff, staff) => {
        const alt = alternate(systemStaff.rows);
        return systemStaff.rows.map((systemRow, index) => {
          const fill = bandFill(systemRow, alt[index]);
          return (
            fill &&
            spans(left, right).map(([from, to], innerIndex) => (
              <rect key={`bd${staff}-${index}-${innerIndex}`} x={from} y={rowY(staff, index)} width={to - from} height={ps.rowH} fill={fill} />
            ))
          );
        });
      })}
      {sys.staves.map((systemStaff, staff) =>
        systemStaff.rows.map((systemRow, index) => (
          <Row
            key={`r${staff}-${index}`}
            ps={ps}
            row={systemRow}
            y={rowY(staff, index)}
            centered={centered}
            articulations={articulationsOf(staff, index)}
            reminders={options.holdReminders}
            techTop={ps.staves[staff].techTop}
          />
        )),
      )}
      {/* au-dessus des cordes, le sens du médiator, en grand : ⊓ vers le bas, V vers le haut */}
      {sys.staves.map((systemStaff, staff) =>
        systemStaff.voice.marks
          .filter((voiceMark) => voiceMark.kind === "articulation" && isPickSign(voiceMark.text))
          .map((voiceMark, index) => {
            const cx = xs[sys.anchors[voiceMark.anchor]] + leadExtra(sys, voiceMark.anchor) + 0.5 + METRICS.noteDigit / 2;
            const cy = ps.staves[staff].techTop + METRICS.techH * 0.55;
            return (
              <path
                key={`pk${staff}-${index}`}
                d={
                  voiceMark.text === "d"
                    ? `M ${cx - 0.9} ${cy + 1} L ${cx - 0.9} ${cy - 0.9} L ${cx + 0.9} ${cy - 0.9} L ${cx + 0.9} ${cy + 1}`
                    : `M ${cx - 0.85} ${cy - 1} L ${cx} ${cy + 1} L ${cx + 0.85} ${cy - 1}`
                }
                fill="none"
                stroke={INK}
                strokeWidth={voiceMark.text === "d" ? 0.42 : 0.36}
                strokeLinejoin="miter"
              />
            );
          }),
      )}
      {/* trait épais entre deux parties d'un même instrument */}
      {ps.staves.map(
        (staffPlace, staff) =>
          staffPlace.separator !== undefined &&
          spans(left, right).map(([from, to], innerIndex) => (
            <line key={`sep${staff}-${innerIndex}`} x1={from} x2={to} y1={staffPlace.separator} y2={staffPlace.separator} stroke={INK} strokeWidth={0.5} />
          )),
      )}
      {/* arpèges : une vaguelette devant l'accord, de sa note la plus grave à la plus aiguë */}
      {sys.arpeggios.map((arpeggio, index) => {
        const attack = (systemRow: SystemRow) => !!systemRow.cells[arpeggio.anchor] && !systemRow.cells[arpeggio.anchor].startsWith("-");
        const ys = sys.staves.flatMap((systemStaff, staff) =>
          arpeggio.staff === undefined || arpeggio.staff === staff ? systemStaff.rows.flatMap((systemRow, innerIndex) => (attack(systemRow) ? [rowY(staff, innerIndex)] : [])) : [],
        );
        if (!ys.length) return null;
        const x = xs[sys.anchors[arpeggio.anchor]] + graceExtra(sys, arpeggio.anchor) + METRICS.arpeggioW / 2 + 0.2;
        return <path key={"arp" + index} d={vwave(x, Math.min(...ys) + 0.5, Math.max(...ys) + ps.rowH - 0.5, arpeggio.down)} {...WAVE} />;
      })}

      {/* séparations verticales, instrument par instrument : temps fins, mesures épaisses, reprises */}
      {ps.parts.map((part, index) => {
        const top = part.top;
        const last = ps.staves[part.last];
        const bottom = last.voiceTop + last.voiceBand;
        const sections = sys.staves
          .map((systemStaff, staff) => (staff >= part.first && staff <= part.last && systemStaff.rows.length ? [rowY(staff, 0), rowY(staff, systemStaff.rows.length)] : null))
          .filter(Boolean) as number[][];
        return (
          <g key={"bars" + index}>
            <line x1={left} x2={left} y1={top} y2={bottom} stroke={INK} strokeWidth={0.45} />
            {sys.columns.map((column, columnIndex) => {
              if (column.kind === "anchor") return null;
              if (column.kind === "beatSep") {
                const x = xs[columnIndex] + ws[columnIndex] / 2;
                return <line key={columnIndex} x1={x} x2={x} y1={top} y2={bottom} stroke={LIGHT} strokeWidth={0.22} />;
              }
              return (
                <BarLine
                  key={columnIndex}
                  x={xs[columnIndex]}
                  width={ws[columnIndex]}
                  column={column}
                  top={top}
                  bottom={bottom}
                  sections={sections}
                  end={columnIndex === sys.columns.length - 1}
                />
              );
            })}
          </g>
        );
      })}

      {sys.staves.map((systemStaff, staff) => {
        const staffPlace = ps.staves[staff];
        return (
          <g key={"bands" + staff}>
            {staffPlace.slurBand > 0 && <SlurBand ps={ps} voice={systemStaff.voice} rows={systemStaff.rows} top={staffPlace.slurTop} />}
            {staffPlace.lyricBand > 0 && <LyricBand ps={ps} voice={systemStaff.voice} top={staffPlace.lyricTop} />}
            {staffPlace.voiceBand > 0 && <VoiceBand ps={ps} voice={systemStaff.voice} top={staffPlace.voiceTop} />}
            {staffPlace.pedalBand > 0 && <PedalBand ps={ps} pedal={systemStaff.pedal} top={staffPlace.pedalTop} />}
          </g>
        );
      })}
      <Marks ps={ps} />
    </g>
  );
}

/**
 * Extrait gravé, pour illustrer la référence : les systèmes seuls, sans page ni en-tête,
 * recadrés au plus près, précédés de l'ordre de jeu s'il y en a un.
 */
export function Excerpt({ pages, options, scale = 1 }: { pages: Page[]; options: RenderOptions; scale?: number }) {
  const systems = pages.flatMap((page) => page.systems);
  if (!systems.length) return null;
  const pad = 1.5;
  // à gauche, la place de l'accolade et des noms de parties
  const first = systems[0];
  const named = first.parts.filter((part) => part.name).map((part) => [...part.name!].length * 1.45 + 2.6);
  const braced = first.parts.some((part) => part.last > part.first) ? 1.8 : 0;
  const x0 = PAGE.marginX - pad - Math.max(braced, ...named);
  const x1 = Math.max(...systems.map((ps) => ps.xs[ps.xs.length - 1] + ps.ws[ps.ws.length - 1])) + pad;
  // un extrait tient sur une page ; s'il en déborde, les pages suivantes sont décalées à la suite
  let offset = 0;
  const placed = pages.flatMap((page, index) => {
    if (index)
      offset += Math.max(...pages[index - 1].systems.map((ps) => ps.y + ps.height)) - Math.min(...page.systems.map((ps) => ps.y)) + METRICS.systemGap;
    return page.systems.map((ps) => ({ ...ps, y: ps.y + offset }));
  });
  const order = pages[0].order;
  const top = Math.min(...placed.map((ps) => ps.y));
  const orderY = top - METRICS.orderH; // l'ordre de jeu, comme en tête de page
  const y0 = (order.length ? orderY : top) - pad;
  const y1 = Math.max(...placed.map((ps) => ps.y + ps.height)) + pad;
  return (
    <svg
      className="excerpt block max-w-full h-auto"
      viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`}
      width={`${(x1 - x0) * scale}mm`}
      height={`${(y1 - y0) * scale}mm`}
      fontFamily={FONT}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="#fff" />
      {order.length > 0 && <OrderLine order={order} y={orderY} cx={(x0 + x1) / 2} />}
      {placed.map((ps, index) => (
        <SystemView key={index} ps={ps} options={options} names={index === 0 || options.namesEverySystem} />
      ))}
    </svg>
  );
}

/**
 * Curseur de lecture : la case jouée, surlignée sur toute la hauteur de son système. Seul ce
 * petit composant se redessine pendant l'écoute ; la page suit le système joué.
 */
function PlayCursor({ page, lookAhead }: { page: Page; lookAhead: boolean }) {
  const { tick } = useSyncExternalStore(player.subscribe, player.getSnapshot);
  const following = useSyncExternalStore(follow.subscribe, follow.active);
  const ref = useRef<SVGRectElement>(null);
  const current = tick === null ? -1 : page.systems.findIndex((ps) => tick >= ps.sys.start && tick < ps.sys.end);
  // la case jouée
  const column = current >= 0 ? columnAt(page.systems[current], tick!) : -1;
  // la descente vers le système suivant, une par système
  const ahead = useRef("");
  // la partition suit le curseur et montre d'avance la mesure suivante, quand l'écran le permet
  useEffect(() => {
    const element = ref.current,
      pane = element?.closest<HTMLElement>("[data-fit]");
    if (!following) ahead.current = "";
    if (!element || !pane || !following) return;
    const glider = glide(pane);
    const view = pane.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    const svg = element.ownerSVGElement!;
    const pageBox = svg.getBoundingClientRect();
    const unit = pageBox.width / PAGE.w; // une unité de la page, à l'écran
    const margin = 16; // la marge gardée au bord de l'écran
    const ps = page.systems[current];
    const bars = barsIn(ps);
    const barIndex = Math.max(
      0,
      bars.findIndex((bar) => bar.includes(column)),
    );
    const left = (bar: number[]) => pageBox.left + ps.xs[bar[0]] * unit;
    const right = (bar: number[]) => pageBox.left + (ps.xs[bar[bar.length - 1]] + ps.ws[bar[bar.length - 1]]) * unit;
    // en coordonnées du contenu, qui ne bougent pas pendant un défilement en cours
    const x = (value: number) => value - view.left + pane.scrollLeft;
    const y = (value: number) => value - view.top + pane.scrollTop;
    // de côté. Pages côte à côte (ajustées à la hauteur) : la page jouée vient à gauche si elle
    // tient dans l'écran, les suivantes se lisent d'avance. Une ligne plus large que l'écran
    // (zoom) : quand la mesure suivante n'est pas en vue, la mesure jouée vient au bord gauche,
    // la suivante à sa droite ; si les deux n'y tiennent pas, la case jouée revient au premier
    // quart avant d'approcher du bord
    const pad = parseFloat(getComputedStyle(pane).scrollPaddingLeft || "0");
    if (pane.dataset.fit === "height" && pageBox.width <= view.width - pad) glider.to("left", x(pageBox.left) - pad);
    else {
      const start = left(bars[barIndex]),
        end = right(bars[Math.min(barIndex + 1, bars.length - 1)]);
      if (box.left < view.left || end > view.right - margin) {
        if (end - start <= view.width - 2 * margin) glider.to("left", x(start) - margin);
        else if (box.left < view.left || box.right > view.right - view.width * 0.15) glider.to("left", x(box.left) - view.width / 4);
      }
    }
    // de haut en bas. Un système hors de l'écran y revient, en haut. Dans la dernière mesure
    // d'un système (option), la page glisse d'un seul mouvement, au rythme de la musique, pour
    // que le système joué ensuite (le suivant, ou celui où ramène une reprise) soit en vue à
    // mi-mesure, sauf s'il est sur la page d'à côté ; le système joué reste en vue, quitte à ne
    // montrer qu'un bout de l'autre. Un système compte en entier : ses textes, sa pédale
    const key = `${page.index}:${current}`;
    if (box.top < view.top || box.bottom > view.bottom) glider.to("top", y(box.top) - margin);
    else if (lookAhead && barIndex === bars.length - 1 && ahead.current !== key) {
      ahead.current = key;
      const then = player.upcoming(ps.sys.end);
      const area =
        then === null
          ? undefined
          : [...pane.querySelectorAll<SVGRectElement>("rect.system-area")].find(
              (candidate) => then >= Number(candidate.dataset.start) && then < Number(candidate.dataset.end),
            );
      const next = area && extent(area);
      const here = extent(svg.querySelectorAll<SVGRectElement>("rect.system-area")[current]);
      if (next && next.left < pageBox.right && next.right > pageBox.left) {
        const below = next.top >= here.bottom - 1,
          above = next.bottom <= here.top + 1;
        const goal = below
          ? Math.min(y(next.bottom) - (view.height - margin), y(here.top) - margin)
          : above
            ? Math.max(y(next.top) - margin, y(here.bottom) - (view.height - margin))
            : pane.scrollTop;
        if ((below && goal > pane.scrollTop + 1) || (above && goal < pane.scrollTop - 1)) {
          // d'ici au milieu de la mesure, en durée de musique (le tempo, les points d'orgue compris)
          const from = player.position() ?? tick!,
            mid = (from + ps.sys.end) / 2;
          const bar0 = (ps.sys.columns[bars[barIndex][0]] as { t: number }).t,
            half = (bar0 + ps.sys.end) / 2;
          const until = Math.max(mid, half);
          glider.to("top", goal, () => {
            const now = player.position();
            return now === null || now < from ? 1 : (now - from) / (until - from);
          });
        }
      }
    }
  }, [current, column, following, lookAhead]);
  if (current < 0) return null;
  return <CursorRect ps={page.systems[current]} column={column} rectRef={ref} />;
}

/** La colonne jouée d'un système à cet instant du morceau. */
export function columnAt(ps: PlacedSystem, tick: number): number {
  const { sys } = ps;
  let current = sys.anchors[0];
  for (const column of sys.anchors) if ((sys.columns[column] as { t: number }).t <= tick) current = column;
  return current;
}

/** La case jouée, surlignée sur toute la hauteur de son système. */
export function CursorRect({ ps, column, rectRef }: { ps: PlacedSystem; column: number; rectRef?: React.Ref<SVGRectElement> }) {
  const { top, bottom } = band(ps);
  return (
    <rect
      ref={rectRef}
      x={ps.xs[column]}
      y={top}
      width={ps.ws[column]}
      height={bottom - top}
      rx={0.6}
      fill="rgba(255, 190, 40, 0.3)"
      style={{ pointerEvents: "none" }}
    />
  );
}

/**
 * Le signe du texte sous le curseur de l'éditeur, encadré sur la partition : sa case, sur la ligne
 * qui le porte (sa portée seule pour une ligne @, tout le système pour la règle). Quand le curseur
 * vient de bouger, le cadre est amené à l'écran.
 */
export function TextMarks({ systems }: { systems: PlacedSystem[] }) {
  const mark = useSyncExternalStore(textMark.subscribe, textMark.get);
  // pendant l'écoute, seul le curseur de lecture se montre, sur toute la hauteur de sa case
  const playing = useSyncExternalStore(player.subscribe, () => ["playing", "loading"].includes(player.getSnapshot().state));
  const ref = useRef<SVGRectElement>(null);
  const at = playing ? undefined : mark?.place;
  const ps = at && systems.find((placedSystem) => at.t >= placedSystem.sys.start && at.t < placedSystem.sys.end);
  useEffect(() => {
    if (ps && mark?.reveal) ref.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [mark, ps]);
  if (!at || !ps) return null;
  const { sys } = ps;
  // la case : la dernière qui commence à l'instant du signe ou avant
  let anchor = 0;
  sys.anchors.forEach((candidate, index) => (sys.columns[candidate] as { t: number }).t <= at.t && (anchor = index));
  const column = sys.anchors[anchor];
  let { top, bottom } = band(ps);
  const staff = at.staff >= 0 ? ps.staves[at.staff] : undefined;
  if (staff) {
    const rows = sys.staves[at.staff].rows;
    const lane = rows.map((systemRow, index) => ({ systemRow, index })).filter((candidate) => rowLane(candidate.systemRow) === at.octave);
    const want = at.content === undefined ? undefined : mainOf(at.content);
    const hit = lane.find((candidate) => want && mainOf(candidate.systemRow.cells[anchor] ?? "") === want) ?? lane[0];
    top = ps.y + staff.rowsTop + (hit ? hit.index : 0) * ps.rowH;
    bottom = hit ? top + ps.rowH : ps.y + staff.bottom;
  }
  return (
    <rect
      ref={ref}
      className="text-mark print:hidden"
      x={ps.xs[column] - 0.3}
      y={top}
      width={ps.ws[column] + 0.6}
      height={bottom - top}
      rx={0.8}
      fill="rgba(43, 93, 110, 0.12)"
      stroke="#2b5d6e"
      strokeWidth={0.35}
      style={{ pointerEvents: "none" }}
    />
  );
}

/**
 * La place d'un système à l'écran, en entier (textes au-dessus de la règle, pédale en dessous) et
 * non sa seule bande jouée : d'après la zone de clic du système, qui la porte.
 */
function extent(area: SVGRectElement) {
  const svg = area.ownerSVGElement!,
    page = svg.getBoundingClientRect(),
    unit = page.width / svg.viewBox.baseVal.width;
  const rect = area.getBoundingClientRect();
  return { left: rect.left, right: rect.right, top: page.top + Number(area.dataset.top) * unit, bottom: page.top + Number(area.dataset.bottom) * unit };
}

/** Les mesures d'un système : les colonnes de leurs cases, de gauche à droite. */
export function barsIn(ps: PlacedSystem): number[][] {
  const bars: number[][] = [[]];
  ps.sys.columns.forEach((column, index) => {
    if (column.kind === "barSep") {
      if (bars[bars.length - 1].length) bars.push([]);
    } else if (column.kind === "anchor") bars[bars.length - 1].push(index);
  });
  return bars.filter((bar) => bar.length);
}

/** Hauteur d'un système, de sa règle au bas de sa dernière portée : celle du curseur. */
function band(ps: PlacedSystem) {
  const last = ps.staves[ps.staves.length - 1];
  return { top: ps.y + ps.rulerTop, bottom: ps.y + last.voiceTop + last.voiceBand };
}

/** Deux touchers du doigt font un double toucher s'ils sont aussi proches, dans le temps (ms) et sur la page (px). */
const TAP_DELAY = 350;
const TAP_SLOP = 30;

/**
 * Zones cliquables, une par système : un clic sur une colonne y place le curseur de lecture, d'où
 * la lecture démarre ou reprend (ou repart tout de suite si elle est en cours). Un double-clic,
 * ou au doigt deux touchers rapprochés, ouvre la retouche de la case.
 */
export function SeekAreas({ systems }: { systems: PlacedSystem[] }) {
  // le dernier toucher du doigt (quand, où), et le dernier double toucher, dont le navigateur peut
  // donner aussi son double-clic
  const tap = useRef({ touch: false, at: 0, x: 0, y: 0, double: 0 });
  // le signe sous le pointeur : son instant, sa portée, son octave, le contenu de sa case
  const placeOf = (ps: PlacedSystem, event: React.MouseEvent<SVGRectElement>) => {
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return undefined;
    const { x, y } = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const { sys } = ps;
    // la colonne sous le clic, ou la plus proche quand on clique entre deux
    let best = sys.anchors[0],
      dist = Infinity;
    for (const column of sys.anchors) {
      const distance = x < ps.xs[column] ? ps.xs[column] - x : x > ps.xs[column] + ps.ws[column] ? x - ps.xs[column] - ps.ws[column] : 0;
      if (distance < dist) {
        best = column;
        dist = distance;
      }
    }
    const tick = (sys.columns[best] as { t: number }).t;
    // la ligne sous le clic (les places des portées se comptent depuis le haut du système)
    const dy = y - ps.y;
    const staff = ps.staves.findIndex((staffPlace, index) => dy >= staffPlace.rowsTop && dy < staffPlace.rowsTop + sys.staves[index].rows.length * ps.rowH);
    const nearest =
      staff >= 0
        ? staff
        : Math.max(
            0,
            ps.staves.findIndex((staffPlace) => dy < staffPlace.bottom),
          );
    const rows = sys.staves[nearest]?.rows ?? [];
    const row = staff >= 0 ? rows[Math.floor((dy - ps.staves[staff].rowsTop) / ps.rowH)] : undefined;
    const anchor = sys.anchors.indexOf(best);
    let content = row?.cells[anchor];
    // une tenue dit quelle note elle prolonge (« -7 ») : celle de la dernière attaque de sa ligne
    if (row && content?.startsWith("-") && !/\d/.test(content)) {
      for (let previous = anchor - 1; previous >= 0; previous--) {
        const cell = row.cells[previous] ?? "";
        const name = cell.match(/^-?(\d+)/)?.[1];
        if (name) {
          content = "-" + name;
          break;
        }
        if (!cell.startsWith("-")) break;
      }
    }
    return { at: { t: tick, staff: rows[0]?.staff ?? nearest, octave: row && rowLane(row), content }, where: { x: event.clientX, y: event.clientY } };
  };
  // un clic place l'écoute (et le curseur du texte) ; un double-clic ouvre la retouche de la case
  const seek = (ps: PlacedSystem, event: React.MouseEvent<SVGRectElement>) => {
    const state = tap.current;
    if (state.touch) {
      const now = performance.now(),
        near = Math.hypot(event.clientX - state.x, event.clientY - state.y) <= TAP_SLOP;
      const twice = now - state.at <= TAP_DELAY && near;
      Object.assign(state, { at: twice ? 0 : now, x: event.clientX, y: event.clientY });
      if (twice) {
        state.double = now;
        return edit(ps, event);
      }
    }
    const place = placeOf(ps, event);
    if (!place) return;
    follow.release();
    player.seek(place.at.t);
    pick.emit(place.at, place.where, "click");
  };
  const edit = (ps: PlacedSystem, event: React.MouseEvent<SVGRectElement>) => {
    if (event.type === "dblclick" && performance.now() - tap.current.double <= TAP_DELAY) return;
    const place = placeOf(ps, event);
    if (place) pick.emit(place.at, place.where, "edit");
  };
  return (
    <g className="seek">
      {systems.map((ps, index) => {
        const { top, bottom } = band(ps);
        const left = ps.xs[ps.sys.anchors[0]],
          last = ps.sys.anchors[ps.sys.anchors.length - 1];
        return (
          <rect
            key={index}
            x={left}
            y={top}
            width={ps.xs[last] + ps.ws[last] - left}
            height={bottom - top}
            className="system-area cursor-pointer"
            fill="transparent"
            data-start={ps.sys.start}
            data-end={ps.sys.end}
            data-top={ps.y}
            data-bottom={ps.y + ps.height}
            onPointerDown={(event) => (tap.current.touch = event.pointerType === "touch")}
            onClick={(event) => seek(ps, event)}
            onDoubleClick={(event) => edit(ps, event)}
          />
        );
      })}
    </g>
  );
}

/*
 * Les signes de l'en-tête, dessinés en millimètres sur la ligne du texte (y = 0) : ils ont la hauteur
 * d'un chiffre (2,2 mm pour un texte de 3,2 mm), centrés comme lui, à mi-hauteur à -1,1 mm.
 */

/** Un métronome : le tempo. */
const MetronomeIcon = () => (
  <g fill="none" stroke={INK} strokeWidth={0.28} strokeLinejoin="round" strokeLinecap="round">
    <path d="M0 0 L0.65 -2 L1.65 -2 L2.3 0 Z" />
    <path d="M1.15 -0.45 L1.95 -2.2" />
  </g>
);

/** Une clé : la tonalité. */
const KeyIcon = () => (
  <g fill="none" stroke={INK} strokeWidth={0.28} strokeLinecap="round">
    <circle cx={0.7} cy={-1.1} r={0.65} />
    <path d="M1.35 -1.1 H3 M2.35 -1.1 V-0.45 M2.85 -1.1 V-0.6" />
  </g>
);

/** Le tempo et la tonalité, à gauche de l'en-tête, l'un sous l'autre : chacun son signe, puis sa valeur. Le dernier est sur la ligne du compositeur. */
function HeaderMarks({ y, marks }: { y: number; marks: { icon: React.ReactNode; text: string; title: string }[] }) {
  const LINE = 4.6;
  return (
    <>
      {marks.map((mark, index) => {
        const base = y - (marks.length - 1 - index) * LINE;
        return (
          <g key={mark.title}>
            <title>{mark.title}</title>
            <g transform={`translate(${PAGE.marginX} ${base})`}>{mark.icon}</g>
            <text x={PAGE.marginX + 4.4} y={base} fontSize={3.2} fill={INK}>
              {mark.text}
            </text>
          </g>
        );
      })}
    </>
  );
}

/** La tonalité en tête de page, comme dans un titre : son nom (« la mineur », « Am »), ou sa forme Prisma sans noms de notes. */
const keyText = (key: Key, names: NoteNames) => keyName(key, names) || prismaKey(key);

/** still : une page immobile (aperçu de la bibliothèque), sans curseur ni clic pour l'écoute. */
export function PageView({
  page,
  total,
  meta,
  options,
  still = false,
}: {
  page: Page;
  total: number;
  meta: Meta;
  options: RenderOptions;
  still?: boolean;
}) {
  const key = meta.key ? parseKey(meta.key) : undefined;
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
            <text
              x={PAGE.w - PAGE.marginX}
              y={PAGE.marginTop + 12 + (meta.subtitle ? METRICS.subtitleH : 0)}
              fontSize={3.4}
              textAnchor="end"
              fill={INK}
            >
              {meta.composer}
            </text>
          )}
          <HeaderMarks
            y={PAGE.marginTop + 12 + (meta.subtitle ? METRICS.subtitleH : 0)}
            marks={[
              ...(meta.bpm ? [{ icon: <MetronomeIcon />, text: String(meta.bpm), title: `tempo : ${meta.bpm} temps par minute` }] : []),
              ...(key ? [{ icon: <KeyIcon />, text: keyText(key, writtenNames(options.noteNames)), title: "tonalité" }] : []),
            ]}
          />
        </g>
      )}
      {/* le récapitulatif des grilles, sous le titre : chaque accord du morceau, une fois */}
      {page.chart?.map((chartItem, index) => (
        <g key={"cc" + index}>
          <text x={chartItem.x} y={chartItem.y + 3.4} fontSize={3.4} fontWeight={700} fill={INK}>
            {chartItem.name}
          </text>
          <ChordGrid shape={chartItem.shape} x={chartItem.x + 0.3} y={chartItem.y + METRICS.chordNameH} />
        </g>
      ))}
      {page.order.length > 0 && (
        <OrderLine order={page.order} y={page.header ? PAGE.marginTop + headerHeight(meta) - 1 : PAGE.marginTop - 2} live={!still} />
      )}
      {/* noms des instruments : au premier système du morceau, comme sur une partition, ou à chaque système (option) */}
      {page.systems.map((ps, index) => (
        <SystemView key={index} ps={ps} options={options} names={(page.index === 0 && index === 0) || options.namesEverySystem} />
      ))}
      <text x={PAGE.w / 2} y={PAGE.h - 8} fontSize={2.6} textAnchor="middle" fill={GREY}>
        {page.index + 1} / {total}
      </text>
      {!still && <TextMarks systems={page.systems} />}
      {!still && <SeekAreas systems={page.systems} />}
      {!still && <PlayCursor page={page} lookAhead={options.lookAhead} />}
    </svg>
  );
}
