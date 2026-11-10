/**
 * Une page du site en Markdown, pour un agent qui la demande (`Accept: text/markdown`, ou son
 * adresse en .md) : le texte de la page écrite au build, sans ce qui ne se lit qu'à l'écran (les
 * boutons, les dessins sans nom), ses exemples dans leur écriture Prisma.
 */
import TurndownService from "turndown";
import type { PageSummary } from "./head.ts";

const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-", emDelimiter: "*" });

const fence = (text: string, language = "") => `\n\n\`\`\`${language}\n${text.replace(/\n+$/, "")}\n\`\`\`\n\n`;
const cell = (node: HTMLElement) => (turndown.turndown(node.innerHTML) || " ").replaceAll("|", "\\|").replaceAll("\n", " ");

// un exemple : son texte Prisma, que porte la figure, plutôt que sa gravure ou ses onglets
turndown.addRule("example", {
  filter: (node) => node.nodeName === "FIGURE" && node.hasAttribute("data-prisma"),
  replacement: (_content, node) => fence((node as HTMLElement).getAttribute("data-prisma")!, "prisma"),
});
// un texte en chasse fixe (un texte Prisma, une tablature), tel qu'il est écrit
turndown.addRule("preformatted", { filter: "pre", replacement: (_content, node) => fence(node.textContent ?? "") });
// un dessin qui a un nom : son nom, en italique ; les autres ne disent rien sans l'écran
turndown.addRule("drawing", {
  filter: (node) => node.nodeName === "svg" || node.nodeName === "SVG",
  replacement: (_content, node) => {
    const label = (node as HTMLElement).getAttribute("aria-label");
    return label ? `\n\n*${label}*\n\n` : "";
  },
});
// un tableau, en tableau Markdown : sa première ligne en tête
turndown.addRule("table", {
  filter: "table",
  replacement: (_content, node) => {
    // le DOM de turndown, sous Node, n'a pas querySelectorAll, et ses listes ne s'itèrent pas
    const rows = Array.from(node.getElementsByTagName("tr")).map((row) =>
      Array.from(row.childNodes)
        .filter((item) => item.nodeName === "TD" || item.nodeName === "TH")
        .map((item) => cell(item as HTMLElement)),
    );
    if (rows.length === 0) return "";
    const line = (cells: string[]) => `| ${cells.join(" | ")} |`;
    return `\n\n${[line(rows[0]), line(rows[0].map(() => "---")), ...rows.slice(1).map(line)].join("\n")}\n\n`;
  },
});
turndown.remove(["button", "nav", "script", "style"]);

/** L'adresse de la page en cours de conversion : ses liens relatifs s'y rattachent, pour un texte lu hors du site. */
let base = "";
turndown.addRule("link", {
  filter: (node) => node.nodeName === "A" && node.hasAttribute("href"),
  replacement: (content, node) => (content.trim() ? `[${content}](${new URL((node as HTMLElement).getAttribute("href")!, base)})` : ""),
});

/** La page en Markdown : son titre, sa description et son adresse en en-tête (YAML), puis le texte de son `<main>`. */
export function pageMarkdown(html: string, { title, description }: PageSummary, url: string) {
  const main = /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1];
  if (main === undefined) throw new Error("la page n'a pas d'élément main");
  base = url;
  const body = turndown.turndown(main).replace(/\n{3,}/g, "\n\n");
  const header = Object.entries({ title, description, url }).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
  return `---\n${header.join("\n")}\n---\n\n${body}\n`;
}
