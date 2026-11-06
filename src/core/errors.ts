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
  let body: number;
  try {
    body = parseFrontmatter(lines).bodyStartLine;
  } catch (error) {
    return error instanceof PrismaError ? [error] : [];
  }
  // les groupes de lignes, séparés par des lignes vides : les systèmes (et leurs indications)
  const groups: [number, number][] = [];
  for (let index = body; index < lines.length; index++) {
    if (!lines[index].trim()) continue;
    let end = index;
    while (end + 1 < lines.length && lines[end + 1].trim()) end++;
    groups.push([index, end]);
    index = end;
  }
  const groupOf = (line: number) => groups.findIndex(([first, last]) => line - 1 >= first && line - 1 <= last);
  const aside = new Set<number>();
  const errors: PrismaError[] = [];
  const work = [...lines];
  for (let guard = 0; guard < groups.length + 1 && errors.length < MAX; guard++) {
    try {
      parsePrisma(work.join("\n"));
      break;
    } catch (error) {
      if (!(error instanceof PrismaError)) break;
      const group = groupOf(error.line);
      // une erreur du morceau entier, ou hors des systèmes : on ne peut pas aller plus loin
      if (error.global || group < 0) {
        if (!aside.size) errors.push(error);
        break;
      }
      const near =
        aside.has(group - 1) || aside.has(group + 1) || (aside.size > 0 && error.cascade && group === firstKept(groups.length, aside));
      if (!(error.cascade && near)) errors.push(error);
      if (aside.has(group)) break; // déjà de côté : l'erreur ne vient pas de ce système
      aside.add(group);
      for (let lineIndex = groups[group][0]; lineIndex <= groups[group][1]; lineIndex++) work[lineIndex] = "";
    }
  }
  return errors.sort((first, second) => first.line - second.line || first.column - second.column);
}

/** Le premier système gardé : il prend la place du premier, dont dépendent les portées. */
function firstKept(count: number, aside: Set<number>) {
  for (let group = 0; group < count; group++) if (!aside.has(group)) return group;
  return -1;
}
