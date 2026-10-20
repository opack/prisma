/**
 * Les exemples du site : un texte .prisma gravé par le vrai moteur de gravure, comme dans la référence.
 * Un exemple montre sa partition, ou à la demande son texte, à copier pour le coller dans
 * l'application : les deux disent la même chose.
 */
import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { parsePrisma } from "../core/index.ts";
import { engrave } from "../app/engrave.ts";
import { CheckIcon, CopyIcon } from "../app/icons.tsx";
import { Excerpt } from "../app/PageView.tsx";
import { DEFAULT_OPTIONS, alignOf } from "../app/options.ts";
import type { RenderOptions } from "../app/options.ts";

type Engraved = { text: string; options?: Partial<RenderOptions>; scale?: number; label: string };

/** La gravure seule. */
function Score({ text, options = {}, scale = 1.5 }: Omit<Engraved, "label">) {
  const o = { ...DEFAULT_OPTIONS, ...options };
  const result = useMemo(() => {
    try {
      return { pages: engrave(parsePrisma(text), { compact: o.density === "compact", chords: o.chords, align: alignOf(o.notePosition), reminders: o.holdReminders, inlineSections: o.sections === "inline" }) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [text, o.density, o.chords, o.notePosition, o.holdReminders, o.sections]);
  return result.pages ? <Excerpt pages={result.pages} options={o} scale={scale} /> : <p className="caption">{result.error}</p>;
}

/** La gravure dans son cadre, sans son texte. */
export function Engraving({ label, ...rest }: Engraved) {
  return (
    <figure className="example" aria-label={label}>
      <Score {...rest} />
    </figure>
  );
}

/** Le bouton qui copie un texte, une icône seule ; sans presse-papiers, il sélectionne le texte. */
function CopyButton({ text, target }: { text: string; target: React.RefObject<HTMLElement | null> }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(target.current!);
      getSelection()?.removeAllRanges();
      getSelection()?.addRange(range);
    }
  };
  const name = copied ? "Copié" : "Copier le texte";
  return (
    <button type="button" className="copy" onClick={copy} aria-label={name} title={name}>
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

/** Un texte Prisma, avec son bouton de copie (qui copie le texte entier, en-tête compris). */
export function Source({ text, header = true }: { text: string; header?: boolean }) {
  const pre = useRef<HTMLPreElement>(null);
  const shown = header ? text : text.replace(/^---[\s\S]*?---\n+/, "");
  return (
    <div className="source">
      <pre ref={pre} className="source-text">
        {shown.trimEnd()}
      </pre>
      <CopyButton text={text} target={pre} />
    </div>
  );
}

/** Un exemple : sa partition, ou son texte, au choix. */
export function Example({ label, text, ...rest }: Engraved) {
  const [view, setView] = useState<"score" | "text">("score");
  const tab = (v: typeof view, name: ReactNode) => (
    <button type="button" role="tab" aria-selected={view === v} className={view === v ? "on" : undefined} onClick={() => setView(v)}>
      {name}
    </button>
  );
  return (
    <figure className="example" aria-label={label}>
      <div className="views" role="tablist" aria-label="Afficher">
        {tab("score", "Partition")}
        {tab("text", "Texte")}
      </div>
      {view === "score" ? <Score text={text} {...rest} /> : <Source text={text} />}
    </figure>
  );
}
