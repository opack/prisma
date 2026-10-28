/**
 * Le partage par un lien : le morceau (son nom, son texte, ses réglages), compressé, tient dans le
 * fragment de l'adresse de l'application (`app/#p=…`). Le fragment n'est jamais envoyé au serveur :
 * le morceau ne passe que par le message qui porte le lien. Ouvrir le lien, c'est le recevoir.
 */
import { isEmpty, parseSettings, writeSettings } from "../options/piece.ts";
import type { PieceSettings } from "../options/piece.ts";

/** Un morceau partagé. */
export type Shared = { name: string; text: string; settings: PieceSettings };

/** La version de ce qu'écrit le lien : un lien d'une autre version ne se lit pas. */
const VERSION = 1;
const PARAM = "p";

/** Au-delà, certaines messageries coupent un lien : mieux vaut envoyer le fichier. */
export const LONG_LINK = 16_000;

async function through(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  return new Uint8Array(await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream)).arrayBuffer());
}

// en base64 sans « + », « / » ni « = », qui se transmettent mal dans une adresse
function toBase64(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64(text: string) {
  const s = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

/** Le nom d'un fichier reçu : sans dossier ni signe qu'un système refuse, en .prisma. */
function safeName(name: unknown) {
  const base = (typeof name === "string" ? name : "").split(/[\\/]/).pop()!.replace(/[:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
  return /\.prisma$/i.test(base) ? base : `${base.replace(/\.(musicxml|xml|txt)$/i, "") || "morceau"}.prisma`;
}

/** Le nom d'un morceau jamais enregistré. */
export const UNNAMED = "morceau.prisma";

/** Le nom sous lequel partager un morceau : son fichier, ou, jamais enregistré, son titre. */
export function shareName(fileName: string, title?: string) {
  return fileName === UNNAMED && title ? safeName(title) : fileName;
}

/** Le morceau, écrit pour le fragment d'un lien. */
export async function encodeShare(s: Shared): Promise<string> {
  const data = { v: VERSION, n: s.name, t: s.text, ...(isEmpty(s.settings) ? {} : { s: JSON.parse(writeSettings(s.settings)) }) };
  return toBase64(await through(new TextEncoder().encode(JSON.stringify(data)), new CompressionStream("deflate-raw")));
}

/** Le morceau d'un fragment ; null s'il ne se lit pas (un lien coupé en route, d'une autre version). */
export async function decodeShare(data: string): Promise<Shared | null> {
  try {
    const raw = JSON.parse(new TextDecoder().decode(await through(fromBase64(data), new DecompressionStream("deflate-raw"))));
    if (raw?.v !== VERSION || typeof raw.t !== "string") return null;
    return { name: safeName(raw.n), text: raw.t, settings: raw.s ? parseSettings(JSON.stringify(raw.s)) : {} };
  } catch {
    return null;
  }
}

/** Le lien qui partage ce fragment, sur la page de l'application. */
export function shareLink(data: string, page: string) {
  const url = new URL(page);
  url.hash = `${PARAM}=${data}`;
  return url.href;
}

/** Le fragment d'un morceau partagé dans une adresse (son « #… »), s'il y en a un. */
export function sharedIn(hash: string): string | null {
  return hash.match(new RegExp(`^#${PARAM}=([\\w-]+)$`))?.[1] ?? null;
}

/**
 * Le fragment d'un morceau partagé dans un lien collé : l'adresse entière, son seul « #p=… », ou ce
 * qui suit « #p= » (espaces et retours à la ligne compris).
 */
export function sharedInLink(link: string): string | null {
  const s = link.replace(/\s+/g, "");
  return s.match(new RegExp(`#?${PARAM}=([\\w-]+)$`))?.[1] ?? (/^[\w-]{16,}$/.test(s) ? s : null);
}
