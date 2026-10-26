/**
 * Les exemples du site : un texte .prisma gravé par le vrai moteur de gravure, comme dans la référence.
 * Un exemple montre sa partition, ou à la demande son texte, à copier pour le coller dans
 * l'application : les deux disent la même chose.
 */
import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { parsePrisma } from "../../core/index.ts";
import { engrave } from "../../app/score/engrave.ts";
import { CheckIcon, CopyIcon } from "../../app/ui/icons.tsx";
import { Excerpt } from "../../app/score/PageView.tsx";
import { DEFAULT_OPTIONS, alignOf } from "../../app/options/options.ts";
import type { RenderOptions } from "../../app/options/options.ts";
import { Caption } from "../layout/Caption.tsx";
import { SourceText } from "./SourceText.tsx";

/**
 * Le cadre d'une gravure ; dans la référence, il garde les marges et la grille de ses exemples.
 * La gravure y tient sa largeur, sauf sur un écran étroit, où le cadre défile.
 */
function frame(guide = false): string {
  return `justify-self-start w-fit max-w-full p-4 border border-line rounded-[10px] bg-white overflow-x-auto [&_.excerpt]:block [&_.excerpt]:max-w-full [&_.excerpt]:h-auto narrow:[&_.excerpt]:max-w-none ${guide ? "mt-[14px] mb-5 grid gap-2.5 justify-items-start" : "m-0"}`;
}

type Engraved = { text: string; options?: Partial<RenderOptions>; scale?: number; label: string; guide?: boolean };

/** La gravure seule. */
function Score({ text, options = {}, scale = 1.5 }: Omit<Engraved, "label" | "guide">) {
  const o = { ...DEFAULT_OPTIONS, ...options };
  const result = useMemo(() => {
    try {
      return { pages: engrave(parsePrisma(text), { compact: o.density === "compact", chords: o.chords, chordNames: o.chordNames, align: alignOf(o.notePosition), reminders: o.holdReminders, inlineSections: o.sections === "inline" }) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [text, o.density, o.chords, o.chordNames, o.notePosition, o.holdReminders, o.sections]);
  return result.pages ? <Excerpt pages={result.pages} options={o} scale={scale} /> : <Caption>{result.error}</Caption>;
}

/** La gravure dans son cadre, sans son texte. */
export function Engraving({ label, guide, ...rest }: Engraved) {
  return (
    <figure className={frame(guide)} aria-label={label}>
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
    <button type="button" className="absolute top-2 right-2 grid place-items-center w-8 h-8 p-0 border border-line rounded-md bg-white text-accent cursor-pointer hover:border-accent" onClick={copy} aria-label={name} title={name}>
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

/** Un texte Prisma, avec son bouton de copie (qui copie le texte entier, en-tête compris). */
export function Source({ text, header = true }: { text: string; header?: boolean }) {
  const pre = useRef<HTMLPreElement>(null);
  const shown = header ? text : text.replace(/^---[\s\S]*?---\n+/, "");
  return (
    <div className="relative justify-self-start w-fit max-w-full min-w-0">
      <SourceText ref={pre} withButton>
        {shown.trimEnd()}
      </SourceText>
      <CopyButton text={text} target={pre} />
    </div>
  );
}

/** Un exemple : sa partition, ou son texte, au choix. */
export function Example({ label, text, guide, ...rest }: Engraved) {
  const [view, setView] = useState<"score" | "text">("score");
  const tab = (v: typeof view, name: ReactNode) => (
    <button type="button" role="tab" aria-selected={view === v} className={`text-[0.85rem] px-2.5 py-[3px] border-0 rounded-[5px] cursor-pointer ${view === v ? "bg-panel text-ink font-bold" : "bg-transparent text-muted"}`} onClick={() => setView(v)}>
      {name}
    </button>
  );
  return (
    <figure className={frame(guide)} aria-label={label}>
      <div className="flex justify-end justify-self-stretch gap-0.5 -mt-1.5 -mr-1.5 mb-2" role="tablist" aria-label="Afficher">
        {tab("score", "Partition")}
        {tab("text", "Texte")}
      </div>
      {view === "score" ? <Score text={text} {...rest} /> : <Source text={text} />}
    </figure>
  );
}
