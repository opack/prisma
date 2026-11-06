import type { Meta } from "./model.ts";
import { parseKey } from "./key.ts";

/**
 * Frontmatter minimal, sous-ensemble de YAML : une clé par ligne, « clé: valeur ».
 * Les valeurs peuvent être entre guillemets. Pas de listes ni d'objets imbriqués.
 */
export type FrontmatterResult = { meta: Meta; bodyStartLine: number };

export class PrismaError extends Error {
  line: number;
  column: number;
  /** Le message seul, sans sa place. */
  reason: string;
  /** La colonne est-elle celle du signe fautif ? Sinon, c'est la ligne entière. */
  exact: boolean;
  /**
   * Une erreur qui tient au système voisin (une mesure à finir, une tenue ou une liaison qui le
   * traverse, les portées du premier système) : elle peut n'être qu'une suite d'une autre erreur.
   */
  cascade: boolean;
  /** Une erreur du morceau entier, vue après tous les systèmes (sections, ordre de jeu, liaisons). */
  global: boolean;
  constructor(message: string, line: number, column?: number, kind?: { cascade?: boolean; global?: boolean }) {
    super(`ligne ${line}, col. ${column ?? 1} : ${message}`);
    this.line = line;
    this.column = column ?? 1;
    this.reason = message;
    this.exact = column !== undefined;
    this.cascade = !!kind?.cascade;
    this.global = !!kind?.global;
  }
}

/**
 * Version du format .prisma. Elle change à chaque modification qui rend un ancien fichier
 * illisible ; un fichier l'indique par « format: N » dans son frontmatter (sans elle, il est
 * lu comme la version courante).
 */
export const FORMAT_VERSION = 1;

const NUMERIC_KEYS = new Set(["cell", "division"]);

export function parseFrontmatter(lines: string[]): FrontmatterResult {
  const meta: Meta = {};
  let index = 0;
  while (index < lines.length && lines[index].trim() === "") index++;
  if (lines[index]?.trim() !== "---") return { meta, bodyStartLine: 0 };
  index++;
  for (; index < lines.length; index++) {
    const raw = lines[index];
    if (raw.trim() === "---") return { meta, bodyStartLine: index + 1 };
    if (raw.trim() === "" || raw.trim().startsWith("#")) continue;
    const match = raw.match(/^\s*([A-Za-zÀ-ÿ_][\wÀ-ÿ-]*)\s*:\s*(.*)$/);
    if (!match) throw new PrismaError("ligne de frontmatter attendue sous la forme « clé: valeur »", index + 1);
    const key = match[1];
    let value = match[2].trim();
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    if (key === "format") {
      const number = Number(value);
      if (!Number.isInteger(number) || number < 0)
        throw new PrismaError("« format » est le numéro de version du format Prisma : un entier, par exemple « format: 1 »", index + 1);
      if (number > FORMAT_VERSION) {
        throw new PrismaError(
          `ce fichier utilise la version ${number} du format Prisma, plus récente que celle de cette application (${FORMAT_VERSION}) : mettez l'application à jour`,
          index + 1,
        );
      }
      if (number < FORMAT_VERSION) {
        throw new PrismaError(
          `ce fichier utilise l'ancienne version ${number} du format Prisma ; cette application lit la version ${FORMAT_VERSION} (voir FORMAT.md)`,
          index + 1,
        );
      }
      continue; // la version n'est pas une information du morceau : l'écriture la remet toujours
    }
    if (key === "bpm") {
      // en temps par minute : le temps est celui de la règle de comptage (la noire pointée d'un 6/8)
      const number = Number(value);
      if (!value || !(number > 0)) {
        throw new PrismaError(
          "« bpm » est un nombre de temps par minute, par exemple « bpm: 78 » ; une indication comme « Andante » se place sur la ligne @ au-dessus de la règle",
          index + 1,
        );
      }
      meta.bpm = number;
      continue;
    }
    if (key === "key") {
      // la tonalité, pour information : gardée telle qu'écrite, Prisma (« 8 », « 5:m ») ou anglaise (« G », « Em »)
      if (!parseKey(value)) {
        throw new PrismaError(
          "« key » est la tonalité du morceau : un nombre de 1 à 12, suivi de « :m » pour une tonalité mineure (« key: 8 », « key: 5:m »), ou son nom anglais (« key: G », « key: Em »)",
          index + 1,
        );
      }
      meta.key = value;
      continue;
    }
    if (NUMERIC_KEYS.has(key)) {
      const number = Number(value);
      if (!Number.isInteger(number) || number < 2) throw new PrismaError(`« ${key} » doit être un entier ≥ 2`, index + 1);
      if (key === "division" && number !== 2 && number !== 3) throw new PrismaError("« division » vaut 2 (binaire) ou 3 (ternaire)", index + 1);
      meta[key] = number;
    } else {
      meta[key] = value;
    }
  }
  throw new PrismaError("frontmatter non fermé : il manque la ligne « --- » de fin", lines.length);
}

const ORDER = ["format", "title", "subtitle", "composer", "bpm", "key", "parts", "source", "notes", "order", "division", "cell"];

/** Frontmatter d'un fichier écrit : toujours avec la version du format, en tête. */
export function writeFrontmatter(meta: Meta): string[] {
  meta = { ...meta, format: FORMAT_VERSION };
  const keys = Object.keys(meta).filter((key) => meta[key] !== undefined && meta[key] !== "");
  keys.sort((first, second) => {
    const firstRank = ORDER.indexOf(first),
      secondRank = ORDER.indexOf(second);
    return (firstRank < 0 ? 99 : firstRank) - (secondRank < 0 ? 99 : secondRank) || first.localeCompare(second);
  });
  const quote = (value: string | number) => {
    const text = String(value);
    // comme en YAML : seuls « : » suivi d'une espace et « # » précédé d'une espace couperaient la valeur
    return /^[\s"']|: |\s#|\s$/.test(text) ? JSON.stringify(text) : text;
  };
  return ["---", ...keys.map((key) => `${key}: ${quote(meta[key]!)}`), "---", ""];
}
