import { FINGER_MARK, TRILL_MARK, octaveOffset } from "../core/index.ts";
import type { Meta, PedalLine, SystemRow, Voice } from "../core/index.ts";
import { FINGER, G, PAGE, splitChord, graceExtra, graceSlotW, headerHeight, leadExtra, lyricTextW, splitNote } from "./engrave.ts";
import type { Page, PlacedSystem } from "./engrave.ts";
import type { OctavePosition, OctaveStyle, RenderOptions } from "./options.ts";
import { octaveTint } from "./colors.ts";
import { player } from "./player.ts";
import { follow } from "./follow.ts";
import { glide, timed } from "./glide.ts";
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
function OctaveTabs({ rows, top, style, position, tabFill, rowH }: { rows: SystemRow[]; top: number; style: OctaveStyle; position: OctavePosition; tabFill: (octave: number) => string; rowH: number }) {
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
        const y = top + g.first * rowH + 0.25;
        const h = g.count * rowH - 0.5;
        return (
          <g key={g.first}>
            <rect x={x} y={y} width={w} height={h} rx={0.6} fill={tabFill(g.octave)} />
            <OctaveMark
              cx={x + w / 2}
              cy={position === "top" ? top + g.first * rowH + rowH / 2 : y + h / 2}
              offset={octaveOffset(g.octave)}
              style={style}
            />
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
function articulationSigns(signs: string[], cx: number, cy: number) {
  const k = G.articulationScale;
  return signs.map((sign, i) => {
    const sx = cx + (i - (signs.length - 1) / 2) * G.articulationStep * k;
    // dessinés autour de (0, 0), puis mis à l'échelle sur place
    const shape =
      sign === "." ? (
        <circle cx={0} cy={0} r={0.3} fill={INK} />
      ) : sign === "!" ? (
        <path d="M -0.42 -0.32 L 0.42 0 L -0.42 0.32" fill="none" stroke={INK} strokeWidth={0.22} />
      ) : (
        <path d="M -0.38 0.32 L 0 -0.38 L 0.38 0.32" fill="none" stroke={INK} strokeWidth={0.26} />
      );
    return (
      <g key={sign} transform={`translate(${sx} ${cy}) scale(${k})`}>
        {shape}
      </g>
    );
  });
}

function Row({ ps, row, y, centered, articulations, reminders }: { ps: PlacedSystem; row: SystemRow; y: number; centered: boolean; articulations?: Map<number, string[]>; reminders: boolean }) {
  const { sys, xs, ws } = ps;
  const x0 = PAGE.marginX;
  const right = xs[xs.length - 1] + ws[ws.length - 1];
  const base = y + ps.rowH * 0.74;
  // petites notes : en petit, en exposant et en gris foncé, en tête de case, rang par rang
  const graces = row.graces.flatMap((list, a) => {
    let x = xs[sys.anchors[a]] + 0.4;
    const dy = centered ? row.center[a] * ps.rowH : 0;
    return sys.staves[row.staff].graceDigits[a].map((d, k) => {
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
        const dy = centered ? row.center[a] * ps.rowH : 0;
        const ci = sys.anchors[a];
        // la note vient après les petites notes et l'arpège de sa case
        const extra = leadExtra(sys, a);
        const x = xs[ci] + extra;
        const w = ws[ci] - extra;
        const mid = y + dy + ps.rowH / 2;
        // trille : la note, sa voisine en petit, puis un trait ondulé sur toute sa durée
        if (row.trill[a] && c === "-") return <path key={a} d={wave(xs[ci], x + w, mid)} {...WAVE} />;
        // note annotée : son articulation au-dessus d'elle, la voisine de trille en petit (en haut à
        // droite), le doigt en négatif (en bas à droite)
        const arts = !c.startsWith("-") ? articulations?.get(a) : undefined;
        if (!c.startsWith("-") && (c.includes(TRILL_MARK) || c.includes(FINGER_MARK) || arts)) {
          const { main, aux, finger } = splitNote(c);
          let end = x + 0.5 + main.length * G.noteDigit;
          // au-dessus des chiffres, à cheval sur le haut de la ligne : assez d'air pour rester lisible
          const art = articulationSigns(arts ?? [], x + 0.5 + (main.length * G.noteDigit) / 2 - 0.15, y + dy - 0.05);
          const auxX = end + 0.35;
          if (aux) end = auxX + aux.length * 1.25;
          const fx = end + FINGER.gap + FINGER.r;
          if (finger) end = fx + FINGER.r;
          return (
            <g key={a}>
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
        // sans rappel (option), une note commencée au système précédent n'est qu'un trait de tenue
        if (c === "-" || (c.startsWith("-") && !reminders)) {
          return <line key={a} x1={x + w * 0.22} x2={x + w * 0.62} y1={y + dy + ps.rowH / 2} y2={y + dy + ps.rowH / 2} stroke={INK} strokeWidth={0.32} />;
        }
        if (c.startsWith("-")) {
          // note commencée au système précédent : le trait de tenue habituel, puis en petit et en
          // gris le rappel de la note tenue (« — 8 »), pour ne pas le lire comme un nombre négatif
          const y1 = y + dy + ps.rowH / 2;
          const x1 = x + 0.5, x2 = x1 + G.holdW;
          return (
            <g key={a}>
              <line x1={x1} x2={x2} y1={y1} y2={y1} stroke={INK} strokeWidth={0.32} />
              <text x={x2 + 0.6} y={base + dy - 0.2} fontSize={2.7} fontWeight={600} fill={GREY}>
                {c.slice(1)}
              </text>
            </g>
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
 * Liaisons d'une portée : un arc fin, creux vers le haut comme une liaison sous les notes, de
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
 * Barre entre deux sections à la suite : la fin de la section (double barre, ou « :|| »), un
 * blanc, puis le début de la suivante, ouverte comme une ligne (trait, ou « ||: »).
 */
function spacedWidths(col: BarCol, x: number, w: number) {
  const close = G.barSep + (col.endRepeat ? G.repeatDots : 0);
  const open = col.startRepeat ? G.repeatDots + G.beatSep : 0;
  return { close, open, gap: [x + close, x + w - open] as [number, number] };
}

/**
 * Barre de mesure, avec ses signes de reprise : « :|| » (points, trait fin, trait épais),
 * « ||: » (trait épais, trait fin, points). Les points sont placés au milieu de chaque portée.
 */
function BarLine({ x, w, col, top, bottom, sections, end }: { x: number; w: number; col: BarCol; top: number; bottom: number; sections: number[][]; end: boolean }) {
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
  if (col.spaced) {
    const { close, open, gap } = spacedWidths(col, x, w);
    const sub = { top, bottom, sections, end: true };
    return (
      <g>
        <BarLine x={x} w={close} col={{ kind: "barSep", endRepeat: col.endRepeat, section: !col.endRepeat }} {...sub} />
        <line x1={gap[1]} x2={gap[1]} y1={top} y2={bottom} stroke={INK} strokeWidth={0.45} />
        {open > 0 && <BarLine x={gap[1]} w={open} col={{ kind: "barSep", lead: true }} {...sub} />}
      </g>
    );
  }
  if (col.lead) return <g>{thin(x + 0.55, "t")}{dots(x + w - d, "d")}</g>;
  if (!col.endRepeat && !col.startRepeat) {
    // fin du morceau : double barre, trait fin puis trait épais
    if (col.final) return <g>{thin(x + w - 1.1, "t")}{thick(x + w - 0.3, "T")}</g>;
    // en fin de système, la barre ferme les couloirs : elle s'aligne sur leur bord droit
    // début de section : double barre
    if (col.section) {
      // aussi marquée qu'une barre de mesure : deux traits de même épaisseur
      const bar = (lx: number, k: string) => <line key={k} x1={lx} x2={lx} y1={top} y2={bottom} stroke={INK} strokeWidth={0.4} />;
      const m = end ? x + w - 0.65 : x + w / 2;
      return <g>{bar(m - 0.45, "t1")}{bar(m + 0.45, "t2")}</g>;
    }
    const lx = end ? x + w - 0.225 : x + w / 2;
    return <line x1={lx} x2={lx} y1={top} y2={bottom} stroke={INK} strokeWidth={0.45} />;
  }
  if (col.endRepeat && col.startRepeat) {
    const m = x + w / 2;
    return <g>{dots(x + d, "a")}{thin(m - 0.75, "t1")}{thick(m, "T")}{thin(m + 0.75, "t2")}{dots(x + w - d, "b")}</g>;
  }
  if (col.endRepeat) return <g>{dots(x + d, "a")}{thin(x + w - 1.1, "t")}{thick(x + w - 0.3, "T")}</g>;
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
          const c = m.column! >= 0 ? (sys.columns[m.column!] as BarCol) : undefined;
          // en cours de ligne, contre la barre qui ouvre la section (après le blanc, s'il y en a un)
          const bar = !c ? left : c.spaced ? spacedWidths(c, xs[m.column!], ws[m.column!]).gap[1] : xs[m.column!] + ws[m.column!] / 2;
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
export function OrderLine({ order, y, cx = PAGE.w / 2, live = false }: { order: string[]; y: number; cx?: number; live?: boolean }) {
  const step = 3.6 + 1.6;
  const x0 = cx - (order.length * step - 1.6) / 2;
  return (
    <g>
      {live && <OrderPlaying x0={x0} step={step} y={y} />}
      {order.map((label, i) => (
        <SectionBox key={i} x={x0 + i * step} y={y} label={label} />
      ))}
      {live && (
        <g className="seek">
          {order.map((label, i) => (
            <rect key={i} x={x0 + i * step - 0.8} y={y - 0.8} width={step} height={4.9} fill="transparent" onClick={() => player.seekEntry(i)}>
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
  const left = PAGE.marginX + G.prefix;
  const right = xs[xs.length - 1] + ws[ws.length - 1];
  const sx = (a: number) => xs[sys.anchors[a]] + leadExtra(sys, a) + 0.5;
  const aEnd = (a: number) => xs[sys.anchors[a]] + ws[sys.anchors[a]];
  const halo = { stroke: "#fff", strokeWidth: 0.6, paintOrder: "stroke" as const, strokeLinejoin: "round" as const };
  return (
    <g>
      {voice.lyrics.map((line, v) => {
        const base = top + 0.4 + v * G.lyricH + G.lyricH * 0.68;
        return (
          <g key={v}>
            {line.syllables.map((x, i) => {
              const end = sx(x.anchor) + lyricTextW(x.text);
              const next = line.syllables[i + 1];
              // trait d'union : au milieu de l'espace jusqu'à la syllabe suivante, ou juste après en fin de système
              const gap = next ? sx(next.anchor) - end : 1.8;
              const hw = Math.min(0.8, gap * 0.4);
              const hx = end + gap / 2;
              return (
                <g key={i}>
                  <text x={sx(x.anchor)} y={base} fontFamily={LYRIC_FONT} fontSize={3.1} fill={INK} {...halo}>
                    {x.text}
                  </text>
                  {x.hyphen && <line x1={hx - hw / 2} x2={hx + hw / 2} y1={base - 0.9} y2={base - 0.9} stroke={INK} strokeWidth={0.22} />}
                </g>
              );
            })}
            {line.extenders.map((e, i) => {
              const syl = e.opens ? line.syllables.find((x) => x.anchor === e.fromAnchor) : undefined;
              const x1 = syl ? sx(e.fromAnchor) + lyricTextW(syl.text) + 0.3 : left;
              const x2 = e.closes ? aEnd(e.toAnchor) - 0.8 : right;
              return x2 > x1 ? <line key={"e" + i} x1={x1} x2={x2} y1={base + 0.35} y2={base + 0.35} stroke={INK} strokeWidth={0.25} /> : null;
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
      {voice.marks.map((m, i) => {
        // l'arpège et les articulations se dessinent sur l'accord (voir SystemView), pas dans cette bande
        if (m.kind === "arpeggio" || m.kind === "articulation") return null;
        // plusieurs indications sur une même case (« pp » puis « con sordina ») : à la suite
        const before = voice.marks.slice(0, i).filter((x) => x.anchor === m.anchor && x.kind !== "arpeggio" && x.kind !== "articulation");
        const x = ax(m.anchor) + before.reduce((w, b) => w + markW(b.text, b.kind) + 1, 0);
        return m.kind === "dynamic" ? (
          <text key={"m" + i} x={x + 0.9} y={base} fontFamily={DYNAMIC_FONT} fontSize={3.6} fontWeight={700} fontStyle="italic" fill={INK} {...halo}>
            {m.text}
          </text>
        ) : (
          <text key={"m" + i} x={x + 0.7} y={base} fontSize={2.8} fontStyle="italic" fill={INK} {...halo}>
            {m.text}
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
  const left = PAGE.marginX + G.prefix;
  const right = xs[xs.length - 1] + ws[ws.length - 1];
  const y = top + G.pedalH * 0.7;
  const hook = 1.5; // hauteur des crochets et des pointes
  const notch = 0.8; // demi-largeur d'une pointe de changement
  const px = (a: number) => xs[sys.anchors[a]] + 0.3;
  const written: string[] = [], implied: string[] = [];
  for (const s of pedal.spans) {
    const staves = s.implied ? implied : written;
    let x1 = s.fromAnchor >= 0 ? px(s.fromAnchor) : left;
    let x2 = s.toAnchor >= 0 ? px(s.toAnchor) : right;
    if (s.changeStart) {
      // pointe du changement, dessinée une seule fois, par la pédale qui commence
      staves.push(`M ${x1 - notch} ${y} L ${x1} ${y - hook} L ${x1 + notch} ${y}`);
      x1 += notch;
    } else if (s.opens) staves.push(`M ${x1} ${y - hook} L ${x1} ${y}`);
    // un changement en fin de système se dessine au début du système suivant
    if (s.changeEnd && s.toAnchor >= 0) x2 -= notch;
    staves.push(`M ${x1} ${y} L ${x2} ${y}`);
    if (s.closes && !s.changeEnd) staves.push(`M ${x2} ${y} L ${x2} ${y - hook}`);
  }
  return (
    <g>
      <text x={PAGE.marginX + G.prefix - 1.2} y={y} fontSize={2.3} fill={GREY} textAnchor="end" fontStyle="italic">
        Ped.
      </text>
      <path d={written.join(" ")} fill="none" stroke={INK} strokeWidth={0.3} strokeLinejoin="round" />
      {/* pédales déduites d'un « Ped. simile », atténuées */}
      {implied.length > 0 && <path d={implied.join(" ")} fill="none" stroke={LIGHT} strokeWidth={0.3} strokeLinejoin="round" />}
      {/* consignes (« Ped. simile ») : sur la ligne de pédale, après un éventuel crochet */}
      {pedal.texts.map((p, i) => (
        <text key={i} x={px(p.anchor) + 0.8} y={y} fontSize={2.8} fontStyle="italic" fill={INK}>
          {p.text}
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
  const mid = (top + bottom) / 2, w = 1.3;
  const d = [
    `M ${x} ${top}`,
    `C ${x - w} ${top + 1}, ${x} ${mid - 1.5}, ${x - w} ${mid}`,
    `C ${x} ${mid + 1.5}, ${x - w} ${bottom - 1}, ${x} ${bottom}`,
    `C ${x - w * 0.6} ${bottom - 1}, ${x + 0.25} ${mid + 1.5}, ${x - w} ${mid}`,
    `C ${x + 0.25} ${mid - 1.5}, ${x - w * 0.6} ${top + 1}, ${x} ${top}`,
  ].join(" ");
  return <path d={d} fill={INK} stroke={INK} strokeWidth={0.1} />;
}

export function SystemView({ ps: placed, options, names }: { ps: PlacedSystem; options: RenderOptions; names: boolean }) {
  // la disposition verticale est calculée depuis le haut du système : on la place sur la page
  const Y = placed.y;
  const ps = {
    ...placed,
    rulerTop: Y + placed.rulerTop,
    staves: placed.staves.map((p) => ({
      ...p,
      separator: p.separator === undefined ? undefined : Y + p.separator,
      rowsTop: Y + p.rowsTop,
      slurTop: Y + p.slurTop,
      lyricTop: Y + p.lyricTop,
      voiceTop: Y + p.voiceTop,
      pedalTop: Y + p.pedalTop,
      bottom: Y + p.bottom,
    })),
    parts: placed.parts.map((x) => ({ ...x, top: Y + x.top, bottom: Y + x.bottom })),
  };
  const { sys, xs, ws } = ps;
  const chordTop = ps.y + ps.textBand + ps.structBand; // bande des accords, juste au-dessus de la règle
  const y = ps.rulerTop; // haut de la règle de comptage
  const x0 = PAGE.marginX;
  const left = x0 + G.prefix;
  const right = xs[xs.length - 1] + ws[ws.length - 1];
  const rulerBase = y + G.rulerH * 0.72;
  const rowsOf = (k: number) => sys.staves[k].rows;
  // sections à la suite : le blanc entre la fin d'une section et la suivante coupe les couloirs
  const gaps = sys.columns.flatMap((c, ci) => (c.kind === "barSep" && c.spaced ? [spacedWidths(c, xs[ci], ws[ci]).gap] : []));
  const spans = (a: number, b: number) => {
    const out: [number, number][] = [];
    let from = a;
    for (const [g0, g1] of gaps) {
      out.push([from, g0]);
      from = g1;
    }
    out.push([from, b]);
    return out;
  };
  const rowY = (k: number, i: number) => ps.staves[k].rowsTop + i * ps.rowH;

  // bandes alternées par groupe d'octave, dans chaque portée
  const alternate = (rows: SystemRow[]) => {
    let group = -1;
    return rows.map((r) => {
      if (r.showOctave) group++;
      return group % 2 === 1;
    });
  };
  // couleur par octave (option) ; sans palette, une bande grise un couloir sur deux
  const tint = (octave: number) => octaveTint(options.octaveColors, octaveOffset(octave));
  const bandFill = (octave: number, alt: boolean) => tint(octave)?.band ?? (alt ? BAND : undefined);
  const tabFill = (octave: number) => tint(octave)?.tab ?? TAB;
  const centered = options.notePosition === "center";
  // articulations de chaque portée : portées par sa note la plus aiguë attaquée dans la case (une fois pour l'accord)
  const articulationsOf = (k: number, i: number) => {
    const p = sys.staves[k];
    const out = new Map<number, string[]>();
    for (const m of p.voice.marks) {
      if (m.kind !== "articulation") continue;
      const top = p.rows.findIndex((r) => !!r.cells[m.anchor] && !r.cells[m.anchor].startsWith("-"));
      if (top === i) out.set(m.anchor, [...(out.get(m.anchor) ?? []), m.text]);
    }
    return out;
  };

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
      {spans(left, right).map(([a, b], j) => (
        <line key={"rl" + j} x1={a} x2={b} y1={y + G.rulerH} y2={y + G.rulerH} stroke={LIGHT} strokeWidth={0.25} />
      ))}
      {/* accords : le nom en haut, les notes Prisma empilées dessous, la basse en bas */}
      {sys.chords.map((c, i) => {
        const { notes, name } = splitChord(c.text);
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

      {/* instruments : une accolade pour plusieurs parties, le nom au premier système */}
      {ps.parts.map((inst, i) => {
        const multi = inst.last > inst.first;
        const top = ps.staves[inst.first].rowsTop, bottom = ps.staves[inst.last].voiceTop + ps.staves[inst.last].voiceBand;
        return (
          <g key={"in" + i}>
            {multi && bottom > top && <Brace x={x0 - 0.3} top={top} bottom={bottom} />}
            {names && inst.name && (
              <text x={x0 - (multi ? 2.2 : 0.8)} y={(top + bottom) / 2 + 1} fontSize={2.8} fontStyle="italic" textAnchor="end" fill={INK}>
                {inst.name}
              </text>
            )}
          </g>
        );
      })}

      {sys.staves.map((p, k) => (
        <OctaveTabs key={"ot" + k} rows={p.rows} top={ps.staves[k].rowsTop} style={options.octaveStyle} position={options.octavePosition} tabFill={tabFill} rowH={ps.rowH} />
      ))}
      {/* fonds des couloirs d'abord : les notes, dessinées ensuite, ne sont jamais recouvertes */}
      {sys.staves.map((p, k) => {
        const alt = alternate(p.rows);
        return p.rows.map((r, i) => {
          const fill = bandFill(r.octave, alt[i]);
          return fill && spans(left, right).map(([a, b], j) => <rect key={`bd${k}-${i}-${j}`} x={a} y={rowY(k, i)} width={b - a} height={ps.rowH} fill={fill} />);
        });
      })}
      {sys.staves.map((p, k) => p.rows.map((r, i) => <Row key={`r${k}-${i}`} ps={ps} row={r} y={rowY(k, i)} centered={centered} articulations={articulationsOf(k, i)} reminders={options.holdReminders} />))}
      {/* trait épais entre deux parties d'un même instrument */}
      {ps.staves.map(
        (pp, k) =>
          pp.separator !== undefined &&
          spans(left, right).map(([a, b], j) => <line key={`sep${k}-${j}`} x1={a} x2={b} y1={pp.separator} y2={pp.separator} stroke={INK} strokeWidth={0.5} />),
      )}
      {/* arpèges : une vaguelette devant l'accord, de sa note la plus grave à la plus aiguë */}
      {sys.arpeggios.map((arp, i) => {
        const attack = (r: SystemRow) => !!r.cells[arp.anchor] && !r.cells[arp.anchor].startsWith("-");
        const ys = sys.staves.flatMap((p, k) => (arp.staff === undefined || arp.staff === k ? p.rows.flatMap((r, j) => (attack(r) ? [rowY(k, j)] : [])) : []));
        if (!ys.length) return null;
        const x = xs[sys.anchors[arp.anchor]] + graceExtra(sys, arp.anchor) + G.arpeggioW / 2 + 0.2;
        return <path key={"arp" + i} d={vwave(x, Math.min(...ys) + 0.5, Math.max(...ys) + ps.rowH - 0.5, arp.down)} {...WAVE} />;
      })}

      {/* séparations verticales, instrument par instrument : temps fins, mesures épaisses, reprises */}
      {ps.parts.map((inst, i) => {
        const top = inst.top;
        const last = ps.staves[inst.last];
        const bottom = last.voiceTop + last.voiceBand;
        const sections = sys.staves
          .map((p, k) => (k >= inst.first && k <= inst.last && p.rows.length ? [rowY(k, 0), rowY(k, p.rows.length)] : null))
          .filter(Boolean) as number[][];
        return (
          <g key={"bars" + i}>
            <line x1={left} x2={left} y1={top} y2={bottom} stroke={INK} strokeWidth={0.45} />
            {sys.columns.map((c, ci) => {
              if (c.kind === "anchor") return null;
              if (c.kind === "beatSep") {
                const x = xs[ci] + ws[ci] / 2;
                return <line key={ci} x1={x} x2={x} y1={top} y2={bottom} stroke={LIGHT} strokeWidth={0.22} />;
              }
              return <BarLine key={ci} x={xs[ci]} w={ws[ci]} col={c} top={top} bottom={bottom} sections={sections} end={ci === sys.columns.length - 1} />;
            })}
          </g>
        );
      })}

      {sys.staves.map((p, k) => {
        const pp = ps.staves[k];
        return (
          <g key={"bands" + k}>
            {pp.slurBand > 0 && <SlurBand ps={ps} voice={p.voice} top={pp.slurTop} />}
            {pp.lyricBand > 0 && <LyricBand ps={ps} voice={p.voice} top={pp.lyricTop} />}
            {pp.voiceBand > 0 && <VoiceBand ps={ps} voice={p.voice} top={pp.voiceTop} />}
            {pp.pedalBand > 0 && <PedalBand ps={ps} pedal={p.pedal} top={pp.pedalTop} />}
          </g>
        );
      })}
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
  // à gauche, la place de l'accolade et des noms de parties
  const first = systems[0];
  const named = first.parts.filter((x) => x.name).map((x) => [...x.name!].length * 1.45 + 2.6);
  const braced = first.parts.some((x) => x.last > x.first) ? 1.8 : 0;
  const x0 = PAGE.marginX - pad - Math.max(braced, ...named);
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
        <SystemView key={i} ps={ps} options={options} names={i === 0 || options.namesEverySystem} />
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
  const k = tick === null ? -1 : page.systems.findIndex((ps) => tick >= ps.sys.start && tick < ps.sys.end);
  // la case jouée
  const ci = k >= 0 ? columnAt(page.systems[k], tick!) : -1;
  // la descente vers le système suivant, une par système
  const ahead = useRef("");
  // la partition suit le curseur et montre d'avance la mesure suivante, quand l'écran le permet
  useEffect(() => {
    const el = ref.current, pane = el?.closest<HTMLElement>(".preview");
    if (!following) ahead.current = "";
    if (!el || !pane || !following) return;
    const g = glide(pane);
    const view = pane.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    const svg = el.ownerSVGElement!;
    const pageBox = svg.getBoundingClientRect();
    const u = pageBox.width / PAGE.w; // une unité de la page, à l'écran
    const m = 16; // la marge gardée au bord de l'écran
    const ps = page.systems[k];
    const bars = barsIn(ps);
    const b = Math.max(0, bars.findIndex((bar) => bar.includes(ci)));
    const left = (bar: number[]) => pageBox.left + ps.xs[bar[0]] * u;
    const right = (bar: number[]) => pageBox.left + (ps.xs[bar[bar.length - 1]] + ps.ws[bar[bar.length - 1]]) * u;
    // en coordonnées du contenu, qui ne bougent pas pendant un défilement en cours
    const x = (v: number) => v - view.left + pane.scrollLeft;
    const y = (v: number) => v - view.top + pane.scrollTop;
    // de côté. Pages côte à côte (ajustées à la hauteur) : la page jouée vient à gauche si elle
    // tient dans l'écran, les suivantes se lisent d'avance. Une ligne plus large que l'écran
    // (zoom) : quand la mesure suivante n'est pas en vue, la mesure jouée vient au bord gauche,
    // la suivante à sa droite ; si les deux n'y tiennent pas, la case jouée revient au premier
    // quart avant d'approcher du bord
    const pad = parseFloat(getComputedStyle(pane).scrollPaddingLeft || "0");
    if (pane.closest(".fit-height") && pageBox.width <= view.width - pad) g.to("left", x(pageBox.left) - pad);
    else {
      const start = left(bars[b]), end = right(bars[Math.min(b + 1, bars.length - 1)]);
      if (box.left < view.left || end > view.right - m) {
        if (end - start <= view.width - 2 * m) g.to("left", x(start) - m);
        else if (box.left < view.left || box.right > view.right - view.width * 0.15) g.to("left", x(box.left) - view.width / 4);
      }
    }
    // de haut en bas. Un système hors de l'écran y revient, en haut. Dans la dernière mesure
    // d'un système (option), la page glisse d'un seul mouvement, au rythme de la musique, pour
    // que le système joué ensuite (le suivant, ou celui où ramène une reprise) soit en vue à
    // mi-mesure, sauf s'il est sur la page d'à côté ; le système joué reste en vue, quitte à ne
    // montrer qu'un bout de l'autre. Un système compte en entier : ses textes, sa pédale
    const key = `${page.index}:${k}`;
    if (box.top < view.top || box.bottom > view.bottom) g.to("top", y(box.top) - m);
    else if (lookAhead && b === bars.length - 1 && ahead.current !== key) {
      ahead.current = key;
      const then = player.upcoming(ps.sys.end);
      const area = then === null ? undefined : [...pane.querySelectorAll<SVGRectElement>("rect.system-area")].find((r) => then >= Number(r.dataset.start) && then < Number(r.dataset.end));
      const next = area && extent(area);
      const here = extent(svg.querySelectorAll<SVGRectElement>("rect.system-area")[k]);
      if (next && next.left < pageBox.right && next.right > pageBox.left) {
        const below = next.top >= here.bottom - 1, above = next.bottom <= here.top + 1;
        const goal = below ? Math.min(y(next.bottom) - (view.height - m), y(here.top) - m) : above ? Math.max(y(next.top) - m, y(here.bottom) - (view.height - m)) : pane.scrollTop;
        if ((below && goal > pane.scrollTop + 1) || (above && goal < pane.scrollTop - 1)) {
          // d'ici au milieu de la mesure, en durée de musique (le tempo, les points d'orgue compris)
          const from = player.position() ?? tick!, mid = (from + ps.sys.end) / 2;
          const bar0 = (ps.sys.columns[bars[b][0]] as { t: number }).t, half = (bar0 + ps.sys.end) / 2;
          const until = Math.max(mid, half);
          g.to("top", goal, () => {
            const now = player.position();
            return now === null || now < from ? 1 : (now - from) / (until - from);
          });
        }
      }
    }
  }, [k, ci, following, lookAhead]);
  if (k < 0) return null;
  return <CursorRect ps={page.systems[k]} ci={ci} rectRef={ref} />;
}

/** La colonne jouée d'un système à cet instant du morceau. */
export function columnAt(ps: PlacedSystem, tick: number): number {
  const { sys } = ps;
  let ci = sys.anchors[0];
  for (const c of sys.anchors) if ((sys.columns[c] as { t: number }).t <= tick) ci = c;
  return ci;
}

/** La case jouée, surlignée sur toute la hauteur de son système. */
export function CursorRect({ ps, ci, rectRef }: { ps: PlacedSystem; ci: number; rectRef?: React.Ref<SVGRectElement> }) {
  const { top, bottom } = band(ps);
  return <rect ref={rectRef} x={ps.xs[ci]} y={top} width={ps.ws[ci]} height={bottom - top} rx={0.6} fill="rgba(255, 190, 40, 0.3)" style={{ pointerEvents: "none" }} />;
}

/**
 * La place d'un système à l'écran, en entier (textes au-dessus de la règle, pédale en dessous) et
 * non sa seule bande jouée : d'après la zone de clic du système, qui la porte.
 */
function extent(area: SVGRectElement) {
  const svg = area.ownerSVGElement!, page = svg.getBoundingClientRect(), u = page.width / svg.viewBox.baseVal.width;
  const r = area.getBoundingClientRect();
  return { left: r.left, right: r.right, top: page.top + Number(area.dataset.top) * u, bottom: page.top + Number(area.dataset.bottom) * u };
}

/** Les mesures d'un système : les colonnes de leurs cases, de gauche à droite. */
export function barsIn(ps: PlacedSystem): number[][] {
  const bars: number[][] = [[]];
  ps.sys.columns.forEach((c, i) => {
    if (c.kind === "barSep") bars[bars.length - 1].length && bars.push([]);
    else if (c.kind === "anchor") bars[bars.length - 1].push(i);
  });
  return bars.filter((bar) => bar.length);
}

/** Hauteur d'un système, de sa règle au bas de sa dernière portée : celle du curseur. */
function band(ps: PlacedSystem) {
  const last = ps.staves[ps.staves.length - 1];
  return { top: ps.y + ps.rulerTop, bottom: ps.y + last.voiceTop + last.voiceBand };
}

/**
 * Zones cliquables, une par système : un clic sur une colonne y place le curseur de lecture, d'où
 * la lecture démarre ou reprend (ou repart tout de suite si elle est en cours).
 */
export function SeekAreas({ systems }: { systems: PlacedSystem[] }) {
  const seek = (ps: PlacedSystem, e: React.MouseEvent<SVGRectElement>) => {
    const m = e.currentTarget.getScreenCTM();
    if (!m) return;
    const x = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()).x;
    const { sys } = ps;
    // la colonne sous le clic, ou la plus proche quand on clique entre deux
    let best = sys.anchors[0], dist = Infinity;
    for (const ci of sys.anchors) {
      const d = x < ps.xs[ci] ? ps.xs[ci] - x : x > ps.xs[ci] + ps.ws[ci] ? x - ps.xs[ci] - ps.ws[ci] : 0;
      if (d < dist) (best = ci), (dist = d);
    }
    follow.release();
    player.seek((sys.columns[best] as { t: number }).t);
  };
  return (
    <g className="seek">
      {systems.map((ps, k) => {
        const { top, bottom } = band(ps);
        const left = ps.xs[ps.sys.anchors[0]], last = ps.sys.anchors[ps.sys.anchors.length - 1];
        return <rect key={k} x={left} y={top} width={ps.xs[last] + ps.ws[last] - left} height={bottom - top} className="system-area" fill="transparent" data-start={ps.sys.start} data-end={ps.sys.end} data-top={ps.y} data-bottom={ps.y + ps.height} onClick={(e) => seek(ps, e)} />;
      })}
    </g>
  );
}

/** still : une page immobile (aperçu de la bibliothèque), sans curseur ni clic pour l'écoute. */
export function PageView({ page, total, meta, options, still = false }: { page: Page; total: number; meta: Meta; options: RenderOptions; still?: boolean }) {
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
          {meta.bpm && (
            <text x={PAGE.marginX} y={PAGE.marginTop + 12 + (meta.subtitle ? G.subtitleH : 0)} fontSize={3.2} fill={INK}>
              {meta.bpm} bpm
            </text>
          )}
        </g>
      )}
      {page.order.length > 0 && <OrderLine order={page.order} y={page.header ? PAGE.marginTop + headerHeight(meta) - 1 : PAGE.marginTop - 2} live={!still} />}
      {/* noms des instruments : au premier système du morceau, comme sur une partition, ou à chaque système (option) */}
      {page.systems.map((ps, i) => (
        <SystemView key={i} ps={ps} options={options} names={(page.index === 0 && i === 0) || options.namesEverySystem} />
      ))}
      <text x={PAGE.w / 2} y={PAGE.h - 8} fontSize={2.6} textAnchor="middle" fill={GREY}>
        {page.index + 1} / {total}
      </text>
      {!still && <SeekAreas systems={page.systems} />}
      {!still && <PlayCursor page={page} lookAhead={options.lookAhead} />}
    </svg>
  );
}
