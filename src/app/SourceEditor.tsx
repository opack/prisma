/**
 * L'éditeur du texte .ymn : les numéros de ligne en marge (celui de la ligne du curseur en
 * évidence, celui d'une erreur en rouge), le texte, puis une barre de statut : la place du
 * curseur dans le texte et dans la musique, et le sens du signe qu'il pointe.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { inspect, octaveOffset } from "../core/index.ts";
import type { NoteNames } from "../core/index.ts";
import { partNames } from "./parts.ts";

type Props = {
  value: string;
  onChange: (text: string) => void;
  textarea: RefObject<HTMLTextAreaElement>;
  /** Ligne d'une erreur de lecture, marquée dans la marge. */
  errorLine?: number;
  noteNames: NoteNames;
  /** Ce qui flotte au-dessus du texte (le bouton de gravure). */
  children?: ReactNode;
};

/** Un signe trop long (une liaison, un soufflet sur plusieurs mesures) s'abrège : ses 9 premiers caractères. */
const short = (t: string) => (t.length > 10 ? t.slice(0, 9) + "…" : t);

export function SourceEditor({ value, onChange, textarea, errorLine, noteNames, children }: Props) {
  const [caret, setCaret] = useState(0);
  const gutter = useRef<HTMLDivElement>(null);
  const follow = () => setCaret(textarea.current?.selectionStart ?? 0);
  // la marge défile avec le texte, sans redessiner
  useEffect(() => {
    const ta = textarea.current;
    if (!ta) return;
    const sync = () => gutter.current && (gutter.current.style.transform = `translateY(${-ta.scrollTop}px)`);
    ta.addEventListener("scroll", sync);
    sync();
    return () => ta.removeEventListener("scroll", sync);
  }, [textarea]);
  // le curseur se déplace aussi au clavier, à la souris et par programme (aller à une erreur)
  useEffect(() => {
    const onSelection = () => document.activeElement === textarea.current && follow();
    document.addEventListener("selectionchange", onSelection);
    return () => document.removeEventListener("selectionchange", onSelection);
  });
  const count = useMemo(() => value.split("\n").length, [value]);
  const info = useMemo(() => inspect(value, Math.min(caret, value.length), noteNames), [value, caret, noteNames]);

  const where: string[] = [];
  if (info.section) where.push(`section ${info.section}`);
  if (info.bar) where.push(`mesure ${info.bar}${info.beat ? `, temps ${info.beat}` : ""}${info.cell && info.cell.count > 1 ? ` (case ${info.cell.index}/${info.cell.count})` : ""}`);
  if (info.part !== undefined && info.instruments) {
    const name = partNames(info.instruments)[info.part];
    if (name && (info.instruments.length > 1 || info.instruments[0].parts > 1)) where.push(name);
  }
  if (info.octave !== undefined) {
    const o = octaveOffset(info.octave);
    where.push(`octave ${o > 0 ? "+" : o < 0 ? "−" : ""}${Math.abs(o)}`);
  }

  return (
    <>
      <div className="editor">
        <div className="gutter" aria-hidden>
          <div ref={gutter}>
            {Array.from({ length: count }, (_, i) => (
              <div key={i} className={i + 1 === errorLine ? "error" : i + 1 === info.line ? "current" : undefined}>
                {i + 1}
              </div>
            ))}
          </div>
        </div>
        <textarea
          ref={textarea}
          value={value}
          spellCheck={false}
          wrap="off"
          aria-label="Source .ymn"
          onChange={(e) => {
            onChange(e.target.value);
            setCaret(e.target.selectionStart);
          }}
          onSelect={follow}
        />
        {children}
      </div>
      <div className="status" role="status" aria-live="polite">
        <span className="status-where">
          Ligne {info.line}, col. {info.column}
          {where.length > 0 && <span> · {where.join(" · ")}</span>}
        </span>
        {info.symbol && (
          <span className="status-what" title={`${short(info.symbol.text)} : ${info.symbol.meaning}`}>
            <code>{short(info.symbol.text)}</code> {info.symbol.meaning}
          </span>
        )}
      </div>
    </>
  );
}
