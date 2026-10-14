/**
 * Notice du pianiste (NOTICE.md), affichée dans l'application : chaque exemple ` ```ymn `
 * y est gravé par le vrai moteur de gravure, sous son texte. La notice suit donc toujours
 * la gravure, sans images à régénérer.
 */
import { Marked } from "marked";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import notice from "../../NOTICE.md?raw";
import { parseYmn } from "../core/index.ts";
import { engrave } from "./engrave.ts";
import { Excerpt } from "./PageView.tsx";
import type { RenderOptions } from "./options.ts";

/** HTML de la notice, avec une place réservée pour chaque exemple gravé. */
function render(markdown: string) {
  const examples: string[] = [];
  const marked = new Marked({
    renderer: {
      code({ text, lang }) {
        if (lang !== "ymn") return false;
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
  return { html: marked.parse(markdown, { async: false }), examples };
}

function Example({ text, options }: { text: string; options: RenderOptions }) {
  const result = useMemo(() => {
    try {
      return { pages: engrave(parseYmn(text), { compact: options.density === "compact", chords: options.chords, align: options.notePosition === "aligned", reminders: options.holdReminders }) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [text, options.density, options.chords, options.notePosition, options.holdReminders]);
  return (
    <>
      <pre className="example-text">{text}</pre>
      {result.pages ? <Excerpt pages={result.pages} options={options} scale={1.4} /> : <p className="problem">{result.error}</p>}
    </>
  );
}

export function NoticeView({ options }: { options: RenderOptions }) {
  const { html, examples } = useMemo(() => render(notice), []);
  const root = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState<Element[]>([]);
  useLayoutEffect(() => {
    setSlots([...(root.current?.querySelectorAll(".example") ?? [])]);
  }, [html]);
  return (
    <article className="guide">
      <div ref={root} dangerouslySetInnerHTML={{ __html: html }} />
      {slots.map((el, i) => createPortal(<Example text={examples[Number((el as HTMLElement).dataset.example)]} options={options} />, el, String(i)))}
    </article>
  );
}
