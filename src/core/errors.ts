/**
 * Toutes les erreurs d'un texte .prisma, en une passe. Le lecteur s'arrête à la première erreur ;
 * ici, le système fautif est mis de côté (ses lignes vidées, leurs numéros gardés) et la lecture
 * reprend, jusqu'à ce qu'elle aboutisse.
 *
 * Mettre un système de côté casse ce qui le traverse : la mesure à finir, une tenue ou une liaison
 * qui continue, les portées du premier système. Les erreurs de cette sorte (cascade), dans un
 * système voisin d'un système mis de côté, ne sont donc que des suites : elles ne sont pas
 * rapportées, et leur système est mis de côté à son tour. De même, les erreurs du morceau entier
 * (sections, ordre de jeu), vues après tous les systèmes, ne sont rapportées que si aucun système
 * n'a été mis de côté. Une erreur de l'en-tête arrête tout.
 */
import { PrismaError, parseFrontmatter } from "./frontmatter.ts";
import { parsePrisma } from "./prisma-parse.ts";

/** Au plus tant d'erreurs : au-delà, le texte est à reprendre de toute façon. */
const MAX = 50;

export function parseErrors(text: string): PrismaError[] {
  const lines = text.replace(/\t/g, "    ").split(/\r?\n/);
  let body = 0;
  try {
    body = parseFrontmatter(lines).bodyStartLine;
  } catch (e) {
    return e instanceof PrismaError ? [e] : [];
  }
  // les groupes de lignes, séparés par des lignes vides : les systèmes (et leurs indications)
  const groups: [number, number][] = [];
  for (let i = body; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    let end = i;
    while (end + 1 < lines.length && lines[end + 1].trim()) end++;
    groups.push([i, end]);
    i = end;
  }
  const groupOf = (line: number) => groups.findIndex(([a, b]) => line - 1 >= a && line - 1 <= b);
  const aside = new Set<number>();
  const errors: PrismaError[] = [];
  const work = [...lines];
  for (let guard = 0; guard < groups.length + 1 && errors.length < MAX; guard++) {
    try {
      parsePrisma(work.join("\n"));
      break;
    } catch (e) {
      if (!(e instanceof PrismaError)) break;
      const g = groupOf(e.line);
      // une erreur du morceau entier, ou hors des systèmes : on ne peut pas aller plus loin
      if (e.global || g < 0) {
        if (!aside.size) errors.push(e);
        break;
      }
      const near = aside.has(g - 1) || aside.has(g + 1) || (aside.size > 0 && e.cascade && g === firstKept(groups.length, aside));
      if (!(e.cascade && near)) errors.push(e);
      if (aside.has(g)) break; // déjà de côté : l'erreur ne vient pas de ce système
      aside.add(g);
      for (let k = groups[g][0]; k <= groups[g][1]; k++) work[k] = "";
    }
  }
  return errors.sort((a, b) => a.line - b.line || a.column - b.column);
}

/** Le premier système gardé : il prend la place du premier, dont dépendent les portées. */
function firstKept(count: number, aside: Set<number>) {
  for (let g = 0; g < count; g++) if (!aside.has(g)) return g;
  return -1;
}
