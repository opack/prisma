/**
 * La référence (REFERENCE.md) en HTML : chaque élément avec ses classes (le Markdown rendu n'a pas
 * d'autre place où les poser), une place réservée pour chaque exemple gravé, et ses titres, pour le
 * sommaire. L'article qui le contient (ReferenceView) donne la taille du texte et sa largeur.
 */
import { Marked } from "marked";
import { slug } from "./slug.ts";

/** Une partie atteinte depuis le sommaire : un peu sous le haut, ou sous le bouton du sommaire d'un écran étroit. */
const ANCHOR = "scroll-mt-4 [@media(max-width:980px)]:scroll-mt-[72px]";
/** Une case de tableau. */
const CELL = "border border-line px-2.5 py-1 text-left align-top";
/** La place d'un exemple, que ReferenceView remplit de sa gravure. */
const EXAMPLE = "grid gap-2.5 justify-items-start mt-[14px] mb-5";

/** Les classes de chaque élément du Markdown rendu (les titres, les exemples : dans leur rendu). */
const CLASSES: [RegExp, string][] = [
  [/<p>/g, `<p class="my-[1em]">`],
  [/<ul>/g, `<ul class="my-[1em] pl-10 list-disc">`],
  [/<ol>/g, `<ol class="my-[1em] pl-10 list-decimal">`],
  [/<a /g, `<a class="underline" `],
  [/<code>/g, `<code class="font-mono text-[13px] bg-panel px-1 py-px rounded-[3px]">`],
  [/<table>/g, `<table class="border-collapse my-3 text-[14px]">`],
  [/<th(?=[ >])/g, `<th class="${CELL} bg-panel"`],
  [/<td(?=[ >])/g, `<td class="${CELL}"`],
];
const styled = (html: string) => CLASSES.reduce((h, [tag, open]) => h.replace(tag, open), html);

/** Un titre : sa taille et ses marges, selon son niveau. */
const HEADING: Record<number, string> = {
  1: "text-[26px] mt-2 mb-4",
  2: `text-[20px] mt-9 mb-2 pt-3 border-t border-line ${ANCHOR}`,
  3: `text-[16px] mt-6 mb-1.5 ${ANCHOR}`,
};

/** Un titre de la référence, pour la table des matières : son niveau, son texte, son ancre. */
export type Heading = { depth: number; text: string; id: string };


/**
 * HTML de la référence, avec une place réservée pour chaque exemple gravé, et ses titres. Une page
 * du site (« guitare.html ») se lit depuis site, le dossier du site : dans l'application, elle
 * s'ouvre à côté, sans quitter le morceau.
 */
export function render(markdown: string, site: string) {
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
        return `<h${depth} id="${id}" class="${HEADING[depth] ?? ""}">${html}</h${depth}>`;
      },
      code({ text, lang }) {
        if (lang !== "prisma") return false;
        examples.push(text);
        return `<div class="example ${EXAMPLE}" data-example="${examples.length - 1}"></div>`;
      },
      // les autres documents du dépôt ne sont pas servis par l'application : leur nom suffit
      link({ href, tokens }) {
        const text = this.parser.parseInline(tokens);
        if (href.endsWith(".md")) return `<strong>${text}</strong>`;
        if (!/^[a-z]+:/.test(href) && href.endsWith(".html")) return `<a href="${site}${href}"${site ? ' target="_blank" rel="noopener"' : ""}>${text}</a>`;
        return false;
      },
    },
  });
  const html = styled(marked.parse(markdown, { async: false }));
  return { html, examples, headings };
}
