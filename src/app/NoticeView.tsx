/**
 * Notice du pianiste (NOTICE.md), affichée dans l'application : chaque exemple ` ```prisma `
 * y est gravé par le vrai moteur de gravure, sous son texte. La notice suit donc toujours
 * la gravure, sans images à régénérer.
 */
import { Marked } from "marked";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import notice from "../../NOTICE.md?raw";
import { parsePrisma } from "../core/index.ts";
import { engrave } from "./engrave.ts";
import { Excerpt } from "./PageView.tsx";
import { alignOf } from "./options.ts";
import type { RenderOptions } from "./options.ts";

/** Un titre de la notice, pour la table des matières : son niveau, son texte, son ancre. */
type Heading = { depth: number; text: string; id: string };

/** L'ancre d'un titre : son texte en minuscules, sans accents ni ponctuation. */
const slug = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** HTML de la notice, avec une place réservée pour chaque exemple gravé, et ses titres. */
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
      return { pages: engrave(parsePrisma(text), { compact: options.density === "compact", chords: options.chords, align: alignOf(options.notePosition), reminders: options.holdReminders, inlineSections: options.sections === "inline" }) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [text, options.density, options.chords, options.notePosition, options.holdReminders, options.sections]);
  return (
    <>
      <pre className="example-text">{text}</pre>
      {result.pages ? <Excerpt pages={result.pages} options={options} scale={1.4} /> : <p className="problem">{result.error}</p>}
    </>
  );
}

/**
 * La notice, avec à sa gauche la table des matières : ses parties et sous-parties, un clic pour y
 * aller ; celle qu'on lit est mise en évidence pendant qu'on fait défiler.
 */
export function NoticeView({ options }: { options: RenderOptions }) {
  const { html, examples, headings } = useMemo(() => render(notice), []);
  const root = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState<Element[]>([]);
  const [current, setCurrent] = useState(headings[0]?.id);
  useLayoutEffect(() => {
    setSlots([...(root.current?.querySelectorAll(".example") ?? [])]);
  }, [html]);

  // la partie lue : le dernier titre passé sous le haut de la zone qui défile
  useEffect(() => {
    const pane = root.current?.closest(".guide-pane");
    if (!pane) return;
    let frame = 0;
    const spy = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const top = pane.getBoundingClientRect().top + 90;
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
    pane.addEventListener("scroll", spy, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      pane.removeEventListener("scroll", spy);
    };
  }, [headings]);

  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="guide-layout">
      <nav className="guide-toc" aria-label="Sommaire de la notice">
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
        {slots.map((el, i) => createPortal(<Example text={examples[Number((el as HTMLElement).dataset.example)]} options={options} />, el, String(i)))}
      </article>
    </div>
  );
}
