import type { Meta } from "./model.ts";

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
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (lines[i]?.trim() !== "---") return { meta, bodyStartLine: 0 };
  i++;
  for (; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.trim() === "---") return { meta, bodyStartLine: i + 1 };
    if (raw.trim() === "" || raw.trim().startsWith("#")) continue;
    const m = raw.match(/^\s*([A-Za-zÀ-ÿ_][\wÀ-ÿ-]*)\s*:\s*(.*)$/);
    if (!m) throw new PrismaError("ligne de frontmatter attendue sous la forme « clé: valeur »", i + 1);
    const key = m[1];
    let value = m[2].trim();
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    if (key === "format") {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0) throw new PrismaError("« format » est le numéro de version du format Prisma : un entier, par exemple « format: 1 »", i + 1);
      if (n > FORMAT_VERSION) {
        throw new PrismaError(`ce fichier utilise la version ${n} du format Prisma, plus récente que celle de cette application (${FORMAT_VERSION}) : mettez l'application à jour`, i + 1);
      }
      if (n < FORMAT_VERSION) {
        throw new PrismaError(`ce fichier utilise l'ancienne version ${n} du format Prisma ; cette application lit la version ${FORMAT_VERSION} (voir FORMAT.md)`, i + 1);
      }
      continue; // la version n'est pas une information du morceau : l'écriture la remet toujours
    }
    if (key === "bpm") {
      // en temps par minute : le temps est celui de la règle de comptage (la noire pointée d'un 6/8)
      const n = Number(value);
      if (!value || !(n > 0)) {
        throw new PrismaError("« bpm » est un nombre de temps par minute, par exemple « bpm: 78 » ; une indication comme « Andante » se place sur la ligne @ au-dessus de la règle", i + 1);
      }
      meta.bpm = n;
      continue;
    }
    if (NUMERIC_KEYS.has(key)) {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 2) throw new PrismaError(`« ${key} » doit être un entier ≥ 2`, i + 1);
      if (key === "division" && n !== 2 && n !== 3) throw new PrismaError("« division » vaut 2 (binaire) ou 3 (ternaire)", i + 1);
      meta[key] = n;
    } else {
      meta[key] = value;
    }
  }
  throw new PrismaError("frontmatter non fermé : il manque la ligne « --- » de fin", lines.length);
}

const ORDER = ["format", "title", "subtitle", "composer", "bpm", "parts", "source", "order", "division", "cell"];

/** Frontmatter d'un fichier écrit : toujours avec la version du format, en tête. */
export function writeFrontmatter(meta: Meta): string[] {
  meta = { ...meta, format: FORMAT_VERSION };
  const keys = Object.keys(meta).filter((k) => meta[k] !== undefined && meta[k] !== "");
  keys.sort((a, b) => {
    const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
  const quote = (v: string | number) => {
    const s = String(v);
    return /^[\s"']|[:#]|\s$/.test(s) ? JSON.stringify(s) : s;
  };
  return ["---", ...keys.map((k) => `${k}: ${quote(meta[k]!)}`), "---", ""];
}
