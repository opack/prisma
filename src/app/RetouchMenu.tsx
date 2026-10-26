/**
 * Le choix de la note d'une case, ouvert par un double-clic sur la partition : les douze notes de
 * l'octave (avec leur nom), ou sur une corde ses cases, de 0 à la dernière ; la tenue, ou la case vidée.
 * Sur une corde, le choix d'une autre corde y montre ses cases (celle du même son marquée) : une case
 * choisie y place la note (qui coupe celle qui y sonnait encore). Sur une note, sa durée, qu'on allonge ou
 * raccourcit d'une case sans quitter le choix ; sur une case vide, les notes de son couloir qu'elle
 * peut tenir. Il s'ouvre à côté du clic ; Échap ou un clic ailleurs le ferme.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MAX_FRET, midiOf, noteName } from "../core/index.ts";
import type { NameDisplay } from "./options.ts";
import { writtenNames } from "./options.ts";
import { KeyboardPicker } from "./keyboard/KeyboardPicker.tsx";
import { mainOf } from "../core/locate.ts";
import { joinCell, splitCell } from "./retouch.ts";

/** Le choix de la case (la note qu'elle a, la corde visée…) : marqué à la couleur de l'accent. */
const CURRENT = "border-accent shadow-[inset_0_0_0_1px_var(--accent)]";
/** Un ajout à la note : doigt, trille, petite note. */
const ADD = "flex-1 px-0 py-0.5 font-mono";
/** Raccourcir, allonger. */
const STEP = "w-[30px] px-0 py-0.5 text-[15px] leading-none";
import type { CellParts } from "./retouch.ts";

type Props = {
  /** Où ouvrir le choix, à l'écran. */
  x: number;
  y: number;
  /** L'octave de la case (scientifique : celle du do central vaut 4). */
  octave?: number;
  /** Sur une corde : son numéro, ce que font sonner les cordes à vide (MIDI, capo compris, de la 1 à la plus grave), et celles où la note peut passer. */
  strings?: { string: number; open: number[]; free: boolean[] };
  /** Place la note sur une corde, à une case. */
  onString: (string: number, fret: number) => void;
  /** La corde dont on montre les cases a changé. */
  onTarget?: (string: number) => void;
  /** Ce que contient la case, et si une tenue peut s'y écrire. */
  content: string;
  canHold: boolean;
  /** La durée de la note de la case (en cases), et ce qu'on peut en faire. */
  duration?: { count: number; longer: boolean; shorter: boolean };
  /** Les notes qu'une case vide peut tenir. */
  holds?: string[];
  names: NameDisplay;
  onPick: (content: string) => void;
  onResize: (by: 1 | -1) => void;
  onHold: (note: string) => void;
  /** Si la note peut monter ou descendre d'une octave (sur une corde : passer sur la corde du dessus ou du dessous), et le faire (le choix reste ouvert). */
  octaves?: { up: boolean; down: boolean };
  onOctave: (dir: 1 | -1) => void;
  /** Réécrit la case (un ajout à sa note) sans fermer le choix. */
  onAmend: (content: string) => void;
  onClose: () => void;
};

/** Un numéro de note, ramené entre 1 et 12. */
const wrap = (n: number) => ((((n - 1) % 12) + 12) % 12) + 1;

export function RetouchMenu({ x, y, octave, strings, content, canHold, duration, holds, names, onPick, onString, onTarget, onResize, onHold, onAmend, octaves, onOctave, onClose }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState({ left: x + 8, top: y + 8 });
  const current = mainOf(content);
  // la corde dont on montre les cases : celle de la note, ou une autre où la placer
  const [target, setTarget] = useState(strings?.string ?? 0);
  const elsewhere = !!strings && target !== strings.string;

  // à côté du clic, sans sortir de la fenêtre
  useLayoutEffect(() => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setPlace({ left: Math.max(8, Math.min(x + 8, innerWidth - r.width - 8)), top: y + 8 + r.height > innerHeight - 8 ? Math.max(8, y - r.height - 8) : y + 8 });
  }, [x, y]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && (e.stopPropagation(), onClose());
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && onClose();
    window.addEventListener("keydown", key, true);
    window.addEventListener("pointerdown", away, true);
    // le choix prend le clavier (Tab, Échap) sans désigner de bouton : la case actuelle seule est marquée
    box.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("pointerdown", away, true);
    };
  }, [onClose]);

  const written = writtenNames(names);
  const short = (midi: number) => noteName(midi, written).replace(/ \(.*\)$/, "");
  const name = (n: number, string = strings?.string) => (strings ? short(strings.open[string! - 1] + n) : octave === undefined ? "" : short(midiOf(octave, n)));
  // le son de la note actuelle, pour marquer la case qui le donne sur une autre corde
  const sounding = strings && /^\d+$/.test(current) ? strings.open[strings.string - 1] + Number(current) : undefined;
  const parts = splitCell(content);
  // sur une corde, les cases de 0 à la dernière ; sinon les douze notes, que la trille fait boucler
  const choices = strings ? Array.from({ length: MAX_FRET + 1 }, (_, k) => k) : Array.from({ length: 12 }, (_, k) => k + 1);
  const near = (n: number) => (strings ? (n >= 0 && n <= MAX_FRET ? n : undefined) : wrap(n));
  // la voisine d'une trille : la plus proche qui porte ce numéro, au-dessus ou au-dessous
  const neighbour = (m: number) => {
    if (strings) return name(m);
    if (octave === undefined || !parts) return "";
    const main = midiOf(octave, Number(parts.note));
    const near = [-1, 0, 1].map((d) => midiOf(octave + d, m)).filter((x) => x !== main).sort((a, b) => Math.abs(a - main) - Math.abs(b - main))[0];
    return noteName(near, written).replace(/ \(.*\)$/, "") || String(m);
  };
  const amend = (change: Partial<CellParts>) => parts && onAmend(joinCell({ ...parts, ...change }));
  const label = strings ? `corde ${target}${written === "none" ? "" : ` (${name(0, target)})`}` : octave === undefined ? "" : octave === 4 ? "octave 0" : `octave ${octave > 4 ? "+" : "−"}${Math.abs(octave - 4)}`;
  return (
    <div ref={box} className="fixed z-30 w-[300px] p-2.5 bg-white border border-line rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.16)] focus:outline-none" role="dialog" aria-label="Note de la case" style={place} tabIndex={-1}>
      <div className="flex items-center justify-between mt-0 mb-2 text-[12.5px] font-semibold">
        <p className="m-0">
          {strings ? "Case" : "Note de la case"} <span className="ml-1 font-normal text-muted">{label}</span>
        </p>
        {octaves && (
          <span className="flex gap-1">
            <button className="px-2 py-px text-[11px]" onClick={() => onOctave(1)} disabled={!octaves.up} title={octaves.up ? "monter la note d'une octave, avec ses tenues" : "plus haut que le clavier"} aria-label="Une octave au-dessus">
              ▲
            </button>
            <button className="px-2 py-px text-[11px]" onClick={() => onOctave(-1)} disabled={!octaves.down} title={octaves.down ? "descendre la note d'une octave, avec ses tenues" : "plus bas que le clavier"} aria-label="Une octave au-dessous">
              ▼
            </button>
          </span>
        )}
      </div>
      {strings && (
        <div className="grid grid-flow-col auto-cols-fr gap-1 mb-1.5 pb-1.5 border-b border-line" role="group" aria-label="Corde">
          {strings.open.map((_, k) => {
            const n = k + 1;
            return (
              <button key={n} className={`grid justify-items-center gap-px px-0 py-[3px] ${n === target ? CURRENT : ""}`} disabled={!strings.free[k]} onClick={() => (setTarget(n), onTarget?.(n))} title={!strings.free[k] ? `la corde ${n} attaque déjà une note à cet instant` : n === strings.string ? "la corde de la note" : `montrer les cases de la corde ${n}, pour y placer la note`}>
                <b className={`font-mono text-[13px] ${n === strings.string ? "underline underline-offset-2" : ""}`}>{n}</b>
                {written !== "none" && <small className="text-[10px] text-muted">{name(0, n)}</small>}
              </button>
            );
          })}
        </div>
      )}
      {names === "keyboard" && !strings ? (
        <KeyboardPicker current={current} onPick={onPick} />
      ) : (
        <div className="grid grid-cols-6 gap-1">
          {choices.map((n) => {
            const same = elsewhere && strings!.open[target - 1] + n === sounding;
            const mark = !elsewhere && String(n) === current ? CURRENT : same ? "border-dashed border-accent bg-accent-10" : "";
            const tip = same ? `${name(n, target)}, le même son` : name(n, target) || undefined;
            return (
              <button key={n} className={`grid justify-items-center gap-px px-0 ${written === "none" ? "py-[7px]" : "pt-[5px] pb-1"} ${mark}`} onClick={() => (strings ? onString(target, n) : onPick(String(n)))} title={tip}>
                <b className="font-mono text-[15px]">{n}</b>
                {written !== "none" && <small className="text-[10.5px] text-muted">{name(n, target)}</small>}
              </button>
            );
          })}
        </div>
      )}
      {elsewhere && <p className="mt-2 mb-0 text-muted text-[12px] leading-[1.35]">Choisissez une case : la note passe sur la corde {target}, avec ses tenues, et coupe ce qui y sonnait encore.</p>}
      {parts && !elsewhere && (
        <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1 mt-2 pt-2 text-[13px] border-t border-line">
          <span className="text-muted">Doigt</span>
          <div className="flex gap-1">
            {(strings ? [1, 2, 3, 4] : [1, 2, 3, 4, 5]).map((f) => (
              <button key={f} className={`${ADD} ${parts.finger === String(f) ? CURRENT : ""}`} onClick={() => amend({ finger: parts.finger === String(f) ? undefined : String(f) })} title={parts.finger === String(f) ? "retirer le doigté" : `jouer avec le doigt ${f}`}>
                {f}
              </button>
            ))}
          </div>
          <span className="text-muted">Trille</span>
          <div className="flex gap-1">
            {[1, 2, -1, -2].map((d) => {
              const v = near(Number(parts.note) + d);
              if (v === undefined) return null;
              const m = String(v);
              return (
                <button key={d} className={`${ADD} ${parts.trill === m ? CURRENT : ""}`} onClick={() => amend({ trill: parts.trill === m ? undefined : m })} title={parts.trill === m ? "retirer la trille" : `alterner avec ${neighbour(Number(m))}`}>
                  ~{m}
                </button>
              );
            })}
          </div>
          <span className="text-muted">Petite note</span>
          <div className="flex gap-1">
            {[-2, -1, 1, 2]
              .map((d) => Number(parts.note) + d)
              .filter((g) => (strings ? g >= 0 && g <= MAX_FRET : g >= 1 && g <= 12))
              .map((g) => {
                const on = parts.graces.includes(String(g));
                return (
                  <button key={g} className={`${ADD} ${on ? CURRENT : ""}`} onClick={() => amend({ graces: on ? parts.graces.filter((x) => x !== String(g)) : [...parts.graces, String(g)] })} title={on ? "retirer cette petite note" : `${name(g) || g} joué très vite juste avant`}>
                    {g}&#8217;
                  </button>
                );
              })}
          </div>
        </div>
      )}
      {duration && !elsewhere && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 text-[13px] border-t border-line">
          <span className="flex-1 text-muted">Durée</span>
          <button className={STEP} onClick={() => onResize(-1)} disabled={!duration.shorter} title={duration.shorter ? "raccourcir d'une case : la dernière tenue s'efface" : "la note ne dure qu'une case"} aria-label="Raccourcir d'une case">
            −
          </button>
          <b className="min-w-[5.5em] text-center font-semibold">
            {duration.count} case{duration.count > 1 ? "s" : ""}
          </b>
          <button className={STEP} onClick={() => onResize(1)} disabled={!duration.longer} title={duration.longer ? "allonger d'une case : une tenue de plus (sur une autre ligne de l'octave si la case d'après est prise)" : "la note va jusqu'au bout du morceau"} aria-label="Allonger d'une case">
            +
          </button>
        </div>
      )}
      {!!holds?.length && !elsewhere && (
        <div className="grid gap-1 mt-2 pt-2 border-t border-line">
          {holds.map((n) => (
            <button key={n} className="text-left" onClick={() => onHold(n)} title={`le ${n} de la case d'avant continue dans celle-ci`}>
              Tenir le {n} <small className="ml-1 text-muted">{name(Number(n))}</small>
            </button>
          ))}
        </div>
      )}
      {!elsewhere && (
        <div className="flex gap-1 mt-1.5">
          <button className={`flex-1 px-0 py-1 ${current === "-" ? CURRENT : ""}`} disabled={!canHold} onClick={() => onPick("-")} title={canHold ? "la note de la case d'avant continue" : "aucune note à prolonger dans la case d'avant"}>
            – Tenue
          </button>
          <button className="flex-1 px-0 py-1" disabled={!content} onClick={() => onPick("")} title="rien ne sonne dans cette case sur cette ligne">
            Vider
          </button>
        </div>
      )}
    </div>
  );
}
