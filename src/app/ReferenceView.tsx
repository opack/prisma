/**
 * La référence (REFERENCE.md), affichée dans l'application et sur le site : chaque exemple ` ```prisma `
 * y est gravé par le vrai moteur de gravure, sous son texte (le site les montre à sa façon). La référence suit donc toujours
 * la gravure, sans images à régénérer.
 */
import { Marked } from "marked";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import reference from "../../REFERENCE.md?raw";
import { parsePrisma } from "../core/index.ts";
import { engrave } from "./engrave.ts";
import { Excerpt } from "./PageView.tsx";
import { alignOf } from "./options.ts";
import { slug } from "./slug.ts";
import "./reference.css";
import type { RenderOptions } from "./options.ts";

/** Un titre de la référence, pour la table des matières : son niveau, son texte, son ancre. */
type Heading = { depth: number; text: string; id: string };


/** HTML de la référence, avec une place réservée pour chaque exemple gravé, et ses titres. */
function render(markdown: string) {
  const examples: string[] = [];
  const headings: Heading[] = [];
  const marked = new Marked({
    renderer: {
      // chaque titre reçoit une ancre ; ceux des parties et sous-parties font la table des matières
      heading({ tokens, depth }) {
        const html = this.parser.parseInline(tokens);
        const text = html.replace(/<[^>]+>/g, "").replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
        const id = slug(text) || `titre-${headings.length}`;
        if (depth === 2 || depth === 3) headings.push({ depth, text, id });
        return `<h${depth} id="${id}">${html}</h${depth}>`;
      },
      code({ text, lang }) {
        if (lang !== "prisma") return false;
        examples.push(text);
        return `<div class="example" data-example="${examples.length - 1}"></div>`;
      },
      // les autres documents du dépôt ne sont pas servis par l'application : leur nom suffit
      link({ href, tokens }) {
        if (!href.endsWith(".md")) return false;
        return `<strong>${this.parser.parseInline(tokens)}</strong>`;
      },
    },
  });
  const html = marked.parse(markdown, { async: false });
  return { html, examples, headings };
}

function Example({ text, options }: { text: string; options: RenderOptions }) {
  const result = useMemo(() => {
    try {
      return { pages: engrave(parsePrisma(text), { compact: options.density === "compact", chords: options.chords, chordNames: options.chordNames, align: alignOf(options.notePosition), reminders: options.holdReminders, inlineSections: options.sections === "inline" }) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [text, options.density, options.chords, options.chordNames, options.notePosition, options.holdReminders, options.sections]);
  return (
    <>
      <pre className="example-text">{text}</pre>
      {result.pages ? <Excerpt pages={result.pages} options={options} scale={1.4} /> : <p className="problem">{result.error}</p>}
    </>
  );
}

/**
 * La référence, avec à sa gauche la table des matières : ses parties et sous-parties, un clic pour y
 * aller ; celle qu'on lit est mise en évidence pendant qu'on fait défiler.
 */
export function ReferenceView({ options, example }: { options: RenderOptions; example?: (text: string) => ReactNode }) {
  const { html, examples, headings } = useMemo(() => render(reference), []);
  const root = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState<Element[]>([]);
  const [current, setCurrent] = useState(headings[0]?.id);
  useLayoutEffect(() => {
    setSlots([...(root.current?.querySelectorAll(".example") ?? [])]);
  }, [html]);

  // une partie demandée par l'adresse (reference.html#… sur le site) : la référence et ses exemples
  // s'écrivent après le chargement, le navigateur n'a pas pu y aller seul
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (slots.length && id) document.getElementById(id)?.scrollIntoView({ behavior: "instant" });
  }, [slots]);

  // la partie lue : le dernier titre passé sous le haut de la zone qui défile (le panneau de
  // l'application, ou la page elle-même sur le site)
  useEffect(() => {
    const pane = root.current?.closest(".guide-pane") ?? document.scrollingElement;
    if (!pane) return;
    const scroller = pane === document.scrollingElement ? window : pane;
    let frame = 0;
    const spy = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const top = (scroller === window ? 0 : pane.getBoundingClientRect().top) + 90;
        let id = headings[0]?.id;
        for (const h of headings) {
          const el = document.getElementById(h.id);
          if (el && el.getBoundingClientRect().top <= top) id = h.id;
        }
        // tout en bas, la dernière partie, même courte
        if (pane.scrollTop + pane.clientHeight >= pane.scrollHeight - 2) id = headings[headings.length - 1]?.id;
        setCurrent(id);
      });
    };
    spy();
    scroller.addEventListener("scroll", spy, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", spy);
    };
  }, [headings]);

  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="guide-layout">
      <nav className="guide-toc" aria-label="Sommaire de la référence">
        <p className="guide-toc-title">Sommaire</p>
        <ul>
          {headings.map((h) => (
            <li key={h.id} className={`depth-${h.depth}` + (h.id === current ? " current" : "")}>
              <a href={`#${h.id}`} onClick={go(h.id)} aria-current={h.id === current ? "location" : undefined}>
                {h.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <article className="guide">
        <div ref={root} dangerouslySetInnerHTML={{ __html: html }} />
        {slots.map((el, i) => {
          const text = examples[Number((el as HTMLElement).dataset.example)];
          return createPortal(example ? example(text) : <Example text={text} options={options} />, el, String(i));
        })}
      </article>
    </div>
  );
}
