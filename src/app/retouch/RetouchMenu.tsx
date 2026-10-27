/**
 * Le choix de la note d'une case, ouvert par un double-clic sur la partition : les douze notes de
 * l'octave (avec leur nom), ou sur une corde ses cases, de 0 à la dernière ; la tenue, ou la case vidée.
 * Sur une corde, le choix d'une autre corde y montre ses cases (celle du même son marquée) : une case
 * choisie y place la note (qui coupe celle qui y sonnait encore). Sur une note, sa durée, qu'on allonge ou
 * raccourcit d'une case sans quitter le choix ; sur une case vide, les notes de son couloir qu'elle
 * peut tenir. Il s'ouvre à côté du clic, dans l'écran (un Popover de React Aria) ; Échap ou un clic
 * ailleurs le ferme. Il prend le clavier sans désigner de bouton : la case actuelle seule est marquée.
 */
import { useRef, useState } from "react";
import { Dialog, Popover } from "react-aria-components";
import { MAX_FRET, midiOf, noteName } from "../../core/index.ts";
import type { NameDisplay } from "../options/options.ts";
import { writtenNames } from "../options/options.ts";
import { Button } from "../ui/button/Button.tsx";
import { KeyboardPicker } from "../ui/keyboard/KeyboardPicker.tsx";
import { mainOf } from "../../core/locate.ts";
import { joinCell, splitCell } from "./retouch.ts";

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
  // le point du clic, auquel le choix s'accroche
  const anchor = useRef<HTMLSpanElement>(null);
  const current = mainOf(content);
  // la corde dont on montre les cases : celle de la note, ou une autre où la placer
  const [target, setTarget] = useState(strings?.string ?? 0);
  const elsewhere = !!strings && target !== strings.string;


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
    <>
      <span ref={anchor} className="fixed size-0" style={{ left: x, top: y }} />
      <Popover className="w-[300px] p-2.5 bg-white border border-line rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.16)] outline-none" triggerRef={anchor} isOpen onOpenChange={(open) => !open && onClose()} placement="bottom start" offset={8} crossOffset={8}>
        <Dialog className="outline-none" aria-label="Note de la case">
          <div className="flex items-center justify-between mt-0 mb-2 text-[12.5px] font-semibold">
            <p className="m-0">
              {strings ? "Case" : "Note de la case"} <span className="ml-1 font-normal text-muted">{label}</span>
            </p>
            {octaves && (
              <span className="flex gap-1">
                <Button size="small" onClick={() => onOctave(1)} disabled={!octaves.up} title={octaves.up ? "monter la note d'une octave, avec ses tenues" : "plus haut que le clavier"} aria-label="Une octave au-dessus">
                  ▲
                </Button>
                <Button size="small" onClick={() => onOctave(-1)} disabled={!octaves.down} title={octaves.down ? "descendre la note d'une octave, avec ses tenues" : "plus bas que le clavier"} aria-label="Une octave au-dessous">
                  ▼
                </Button>
              </span>
            )}
          </div>
          {strings && (
            <div className="grid grid-flow-col auto-cols-fr gap-1 mb-1.5 pb-1.5 border-b border-line" role="group" aria-label="Corde">
              {strings.open.map((_, k) => {
                const n = k + 1;
                return (
                  <Button key={n} size="small" pressed={n === target} disabled={!strings.free[k]} onClick={() => (setTarget(n), onTarget?.(n))} title={!strings.free[k] ? `la corde ${n} attaque déjà une note à cet instant` : n === strings.string ? "la corde de la note" : `montrer les cases de la corde ${n}, pour y placer la note`}>
                    <span className="grid justify-items-center gap-px">
                      <b className={`font-mono text-[13px] ${n === strings.string ? "underline underline-offset-2" : ""}`}>{n}</b>
                      {written !== "none" && <small className="text-[10px] text-muted">{name(0, n)}</small>}
                    </span>
                  </Button>
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
                const tip = same ? `${name(n, target)}, le même son` : name(n, target) || undefined;
                return (
                  <Button key={n} size="small" pressed={!elsewhere && String(n) === current} onClick={() => (strings ? onString(target, n) : onPick(String(n)))} title={tip}>
                    {/* sur une autre corde, la case du même son : son numéro souligné de tirets */}
                    <span className={`grid justify-items-center gap-px ${written === "none" ? "py-1" : ""}`}>
                      <b className={`font-mono text-[15px] ${same ? "underline decoration-dashed decoration-accent underline-offset-3" : ""}`}>{n}</b>
                      {written !== "none" && <small className="text-[10.5px] text-muted">{name(n, target)}</small>}
                    </span>
                  </Button>
                );
              })}
            </div>
          )}
          {!content && !elsewhere && <p className="mt-2 mb-0 text-muted text-[12px] leading-[1.35]">La note choisie, le choix reste ouvert : son doigté, sa trille, sa durée.</p>}
          {elsewhere && <p className="mt-2 mb-0 text-muted text-[12px] leading-[1.35]">Choisissez une case : la note passe sur la corde {target}, avec ses tenues, et coupe ce qui y sonnait encore.</p>}
          {parts && !elsewhere && (
            <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1 mt-2 pt-2 text-[13px] border-t border-line">
              <span className="text-muted">Doigt</span>
              <div className="flex gap-1">
                {(strings ? [1, 2, 3, 4] : [1, 2, 3, 4, 5]).map((f) => (
                  <Button key={f} className="flex-1 font-mono" size="small" pressed={parts.finger === String(f)} onClick={() => amend({ finger: parts.finger === String(f) ? undefined : String(f) })} title={parts.finger === String(f) ? "retirer le doigté" : `jouer avec le doigt ${f}`}>
                    {f}
                  </Button>
                ))}
              </div>
              <span className="text-muted">Trille</span>
              <div className="flex gap-1">
                {[1, 2, -1, -2].map((d) => {
                  const v = near(Number(parts.note) + d);
                  if (v === undefined) return null;
                  const m = String(v);
                  return (
                    <Button key={d} className="flex-1 font-mono" size="small" pressed={parts.trill === m} onClick={() => amend({ trill: parts.trill === m ? undefined : m })} title={parts.trill === m ? "retirer la trille" : `alterner avec ${neighbour(Number(m))}`}>
                      ~{m}
                    </Button>
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
                      <Button key={g} className="flex-1 font-mono" size="small" pressed={on} onClick={() => amend({ graces: on ? parts.graces.filter((x) => x !== String(g)) : [...parts.graces, String(g)] })} title={on ? "retirer cette petite note" : `${name(g) || g} joué très vite juste avant`}>
                        {g}&#8217;
                      </Button>
                    );
                  })}
              </div>
            </div>
          )}
          {duration && !elsewhere && (
            <div className="flex items-center gap-1.5 mt-2 pt-2 text-[13px] border-t border-line">
              <span className="flex-1 text-muted">Durée</span>
              <Button size="small" onClick={() => onResize(-1)} disabled={!duration.shorter} title={duration.shorter ? "raccourcir d'une case : la dernière tenue s'efface" : "la note ne dure qu'une case"} aria-label="Raccourcir d'une case">
                −
              </Button>
              <b className="min-w-[5.5em] text-center font-semibold">
                {duration.count} case{duration.count > 1 ? "s" : ""}
              </b>
              <Button size="small" onClick={() => onResize(1)} disabled={!duration.longer} title={duration.longer ? "allonger d'une case : une tenue de plus (sur une autre ligne de l'octave si la case d'après est prise)" : "la note va jusqu'au bout du morceau"} aria-label="Allonger d'une case">
                +
              </Button>
            </div>
          )}
          {!!holds?.length && !elsewhere && (
            <div className="grid gap-1 mt-2 pt-2 border-t border-line">
              {holds.map((n) => (
                <Button key={n} onClick={() => onHold(n)} title={`le ${n} de la case d'avant continue dans celle-ci`}>
                  <span className="flex-1 text-left">
                    Tenir le {n} <small className="ml-1 text-muted">{name(Number(n))}</small>
                  </span>
                </Button>
              ))}
            </div>
          )}
          {!elsewhere && (
            <div className="flex gap-1 mt-1.5">
              <Button className="flex-1" pressed={current === "-"} disabled={!canHold} onClick={() => onPick("-")} title={canHold ? "la note de la case d'avant continue" : "aucune note à prolonger dans la case d'avant"}>
                – Tenue
              </Button>
              <Button className="flex-1" disabled={!content} onClick={() => onPick("")} title="rien ne sonne dans cette case sur cette ligne">
                Vider
              </Button>
            </div>
          )}
        </Dialog>
      </Popover>
    </>
  );
}
