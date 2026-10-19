/**
 * Le choix de la note d'une case, ouvert par un double-clic sur la partition : les douze notes de
 * l'octave (avec leur nom), la tenue, ou la case vidée. Sur une note, sa durée, qu'on allonge ou
 * raccourcit d'une case sans quitter le choix ; sur une case vide, les notes de son couloir qu'elle
 * peut tenir. Il s'ouvre à côté du clic ; Échap ou un clic ailleurs le ferme.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { midiOf, noteName } from "../core/index.ts";
import type { NoteNames } from "../core/index.ts";
import { mainOf } from "../core/locate.ts";
import { joinCell, splitCell } from "./retouch.ts";
import type { CellParts } from "./retouch.ts";

type Props = {
  /** Où ouvrir le choix, à l'écran. */
  x: number;
  y: number;
  /** L'octave de la case (scientifique : celle du do central vaut 4). */
  octave?: number;
  /** Ce que contient la case, et si une tenue peut s'y écrire. */
  content: string;
  canHold: boolean;
  /** La durée de la note de la case (en cases), et ce qu'on peut en faire. */
  duration?: { count: number; longer: boolean; shorter: boolean };
  /** Les notes qu'une case vide peut tenir. */
  holds?: string[];
  names: NoteNames;
  onPick: (content: string) => void;
  onResize: (by: 1 | -1) => void;
  onHold: (note: string) => void;
  /** Si la note peut monter ou descendre d'une octave, et le faire (le choix reste ouvert). */
  octaves?: { up: boolean; down: boolean };
  onOctave: (dir: 1 | -1) => void;
  /** Réécrit la case (un ajout à sa note) sans fermer le choix. */
  onAmend: (content: string) => void;
  onClose: () => void;
};

/** Un numéro de note, ramené entre 1 et 12. */
const wrap = (n: number) => ((((n - 1) % 12) + 12) % 12) + 1;

export function RetouchMenu({ x, y, octave, content, canHold, duration, holds, names, onPick, onResize, onHold, onAmend, octaves, onOctave, onClose }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState({ left: x + 8, top: y + 8 });
  const current = mainOf(content);

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

  const name = (n: number) => (octave === undefined ? "" : noteName(midiOf(octave, n), names).replace(/ \(.*\)$/, ""));
  const parts = splitCell(content);
  // la voisine d'une trille : la plus proche qui porte ce numéro, au-dessus ou au-dessous
  const neighbour = (m: number) => {
    if (octave === undefined || !parts) return "";
    const main = midiOf(octave, Number(parts.note));
    const near = [-1, 0, 1].map((d) => midiOf(octave + d, m)).filter((x) => x !== main).sort((a, b) => Math.abs(a - main) - Math.abs(b - main))[0];
    return noteName(near, names).replace(/ \(.*\)$/, "");
  };
  const amend = (change: Partial<CellParts>) => parts && onAmend(joinCell({ ...parts, ...change }));
  const label = octave === undefined ? "" : octave === 4 ? "octave 0" : `octave ${octave > 4 ? "+" : "−"}${Math.abs(octave - 4)}`;
  return (
    <div ref={box} className="retouch-menu" role="dialog" aria-label="Note de la case" style={place} tabIndex={-1}>
      <div className="retouch-title">
        <p>
          Note de la case <span>{label}</span>
        </p>
        {octaves && (
          <span className="retouch-octave">
            <button onClick={() => onOctave(1)} disabled={!octaves.up} title={octaves.up ? "monter la note d'une octave, avec ses tenues" : "plus haut que le clavier"} aria-label="Une octave au-dessus">
              ▲
            </button>
            <button onClick={() => onOctave(-1)} disabled={!octaves.down} title={octaves.down ? "descendre la note d'une octave, avec ses tenues" : "plus bas que le clavier"} aria-label="Une octave au-dessous">
              ▼
            </button>
          </span>
        )}
      </div>
      <div className="retouch-notes">
        {Array.from({ length: 12 }, (_, k) => k + 1).map((n) => (
          <button key={n} className={String(n) === current ? "current" : undefined} onClick={() => onPick(String(n))} title={name(n)}>
            <b>{n}</b>
            <small>{name(n)}</small>
          </button>
        ))}
      </div>
      {parts && (
        <div className="retouch-adds">
          <span>Doigt</span>
          <div>
            {[1, 2, 3, 4, 5].map((f) => (
              <button key={f} className={parts.finger === String(f) ? "current" : undefined} onClick={() => amend({ finger: parts.finger === String(f) ? undefined : String(f) })} title={parts.finger === String(f) ? "retirer le doigté" : `jouer avec le doigt ${f}`}>
                {f}
              </button>
            ))}
          </div>
          <span>Trille</span>
          <div>
            {[1, 2, -1, -2].map((d) => {
              const m = String(wrap(Number(parts.note) + d));
              return (
                <button key={d} className={parts.trill === m ? "current" : undefined} onClick={() => amend({ trill: parts.trill === m ? undefined : m })} title={parts.trill === m ? "retirer la trille" : `alterner avec ${neighbour(Number(m))}`}>
                  ~{m}
                </button>
              );
            })}
          </div>
          <span>Petite note</span>
          <div>
            {[-2, -1, 1, 2]
              .map((d) => Number(parts.note) + d)
              .filter((g) => g >= 1 && g <= 12)
              .map((g) => {
                const on = parts.graces.includes(String(g));
                return (
                  <button key={g} className={on ? "current" : undefined} onClick={() => amend({ graces: on ? parts.graces.filter((x) => x !== String(g)) : [...parts.graces, String(g)] })} title={on ? "retirer cette petite note" : `${name(g)} joué très vite juste avant`}>
                    {g}&#8217;
                  </button>
                );
              })}
          </div>
        </div>
      )}
      {duration && (
        <div className="retouch-duration">
          <span>Durée</span>
          <button onClick={() => onResize(-1)} disabled={!duration.shorter} title={duration.shorter ? "raccourcir d'une case : la dernière tenue s'efface" : "la note ne dure qu'une case"} aria-label="Raccourcir d'une case">
            −
          </button>
          <b>
            {duration.count} case{duration.count > 1 ? "s" : ""}
          </b>
          <button onClick={() => onResize(1)} disabled={!duration.longer} title={duration.longer ? "allonger d'une case : une tenue de plus (sur une autre ligne de l'octave si la case d'après est prise)" : "la note va jusqu'au bout du morceau"} aria-label="Allonger d'une case">
            +
          </button>
        </div>
      )}
      {!!holds?.length && (
        <div className="retouch-holds">
          {holds.map((n) => (
            <button key={n} onClick={() => onHold(n)} title={`le ${n} de la case d'avant continue dans celle-ci`}>
              Tenir le {n} <small>{name(Number(n))}</small>
            </button>
          ))}
        </div>
      )}
      <div className="retouch-more">
        <button className={current === "-" ? "current" : undefined} disabled={!canHold} onClick={() => onPick("-")} title={canHold ? "la note de la case d'avant continue" : "aucune note à prolonger dans la case d'avant"}>
          – Tenue
        </button>
        <button disabled={!content} onClick={() => onPick("")} title="rien ne sonne dans cette case sur cette ligne">
          Vider
        </button>
      </div>
    </div>
  );
}
