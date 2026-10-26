/**
 * Réglages d'un morceau : ce qu'on choisit pour lui seul (le tempo, les portées muettes, les
 * options de son rendu), rangés dans un fichier à côté de lui, du même nom suivi de .json
 * (« gymnopedie.prisma.json »). La partition reste propre : on peut la diffuser sans ses choix
 * personnels. Une option du rendu définie pour le morceau y est écrite telle quelle, même égale
 * à l'option générale : le morceau garde son rendu sur un autre ordinateur, aux options
 * générales différentes. Celles qu'il ne définit pas suivent les options générales.
 */
import type { RenderOptions } from "./options.ts";
import { loadOptions } from "./options.ts";
import { isInstrument } from "../playback/instruments.ts";

/** Les options qu'une partition peut définir pour elle-même : tout ce qui fait son rendu. */
export const PIECE_KEYS = ["chords", "chordNames", "chordChart", "namesEverySystem", "sections", "simile", "octavePosition", "octaveStyle", "octaveColors", "density", "notePosition", "holdReminders", "fingerings"] as const;
export type PieceKey = (typeof PIECE_KEYS)[number];
export const isPieceKey = (k: string): k is PieceKey => (PIECE_KEYS as readonly string[]).includes(k);

export type PieceSettings = {
  /** Le tempo choisi pour l'écoute, à la place de celui de la partition. */
  tempo?: number;
  /** Les portées muettes (leurs numéros), qu'on joue soi-même. */
  muted?: number[];
  /** L'instrument choisi pour chaque partie, dans l'ordre ; null : celui que son nom fait deviner. */
  instruments?: (string | null)[];
  /** Le volume de chaque partie à l'écoute, dans l'ordre : en décibels, 0 tel quel. */
  volumes?: number[];
  /** Les options du rendu définies pour ce morceau : elles priment sur les générales. */
  options?: Partial<Pick<RenderOptions, PieceKey>>;
};

const FORMAT = 1;
export const MIN_TEMPO = 20;
export const MAX_TEMPO = 300;
/** Les volumes d'une partie : de beaucoup moins fort à un peu plus fort (en décibels). */
export const MIN_VOLUME = -12;
export const MAX_VOLUME = 6;

/** Le fichier des réglages d'un morceau. */
export const settingsName = (pieceName: string) => `${pieceName}.json`;

/** Rien à retenir ? */
export const isEmpty = (s: PieceSettings) => s.tempo === undefined && !s.muted?.length && !s.instruments?.some((t) => t !== null) && !s.volumes?.some((v) => v !== 0) && !Object.keys(s.options ?? {}).length;

/**
 * Lit des réglages : ce qui n'est pas compris est laissé de côté (une option inconnue, une valeur
 * hors de ses choix), le reste s'applique.
 */
export function parseSettings(text: string): PieceSettings {
  const raw = JSON.parse(text);
  if (typeof raw !== "object" || raw === null) throw new Error("réglages illisibles");
  if (raw.format !== FORMAT) throw new Error(`version ${raw.format ?? "?"} des réglages, attendu ${FORMAT}`);
  const out: PieceSettings = {};
  if (Number.isInteger(raw.tempo) && raw.tempo >= MIN_TEMPO && raw.tempo <= MAX_TEMPO) out.tempo = raw.tempo;
  if (Array.isArray(raw.muted)) {
    const muted = raw.muted.filter((k: unknown) => Number.isInteger(k) && (k as number) >= 0);
    if (muted.length) out.muted = [...new Set<number>(muted)].sort((a, b) => a - b);
  }
  if (Array.isArray(raw.instruments)) {
    const instruments = raw.instruments.map((t: unknown) => (isInstrument(t) ? t : null));
    if (instruments.some((t: string | null) => t !== null)) out.instruments = instruments;
  }
  if (Array.isArray(raw.volumes)) {
    const volumes = raw.volumes.map((v: unknown) => (Number.isInteger(v) ? Math.min(MAX_VOLUME, Math.max(MIN_VOLUME, v as number)) : 0));
    if (volumes.some((v: number) => v !== 0)) out.volumes = volumes;
  }
  if (raw.options && typeof raw.options === "object") {
    // les valeurs se valident comme celles des options générales : une valeur refusée y reprend la valeur par défaut
    const checked = loadOptionsFrom(raw.options);
    const options: PieceSettings["options"] = {};
    for (const k of PIECE_KEYS) if (k in raw.options && checked[k] === raw.options[k]) (options as Record<string, unknown>)[k] = checked[k];
    if (Object.keys(options).length) out.options = options;
  }
  return out;
}

export function writeSettings(s: PieceSettings): string {
  const out: Record<string, unknown> = { format: FORMAT };
  if (s.tempo !== undefined) out.tempo = s.tempo;
  if (s.muted?.length) out.muted = s.muted;
  if (s.instruments?.some((t) => t !== null)) out.instruments = s.instruments;
  if (s.volumes?.some((v) => v !== 0)) out.volumes = s.volumes;
  if (s.options && Object.keys(s.options).length) out.options = s.options;
  return JSON.stringify(out, null, 2) + "\n";
}

/** Valide des options comme celles enregistrées dans le navigateur. */
function loadOptionsFrom(raw: object): RenderOptions {
  return loadOptions(JSON.stringify(raw));
}

/** Les réglages d'un morceau, s'il y en a, dans le dossier du morceau. */
export async function readSettings(dir: FileSystemDirectoryHandle, pieceName: string): Promise<PieceSettings | null> {
  let file: File;
  try {
    file = await (await dir.getFileHandle(settingsName(pieceName))).getFile();
  } catch {
    return null;
  }
  return parseSettings(await file.text());
}

/** Enregistre les réglages d'un morceau à côté de lui ; sans réglage, le fichier disparaît. */
export async function saveSettings(dir: FileSystemDirectoryHandle, pieceName: string, s: PieceSettings) {
  const name = settingsName(pieceName);
  if (isEmpty(s)) {
    await dir.removeEntry(name).catch(() => undefined);
    return;
  }
  const out = await (await dir.getFileHandle(name, { create: true })).createWritable();
  await out.write(writeSettings(s));
  await out.close();
}
