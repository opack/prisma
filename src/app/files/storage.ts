/**
 * Ce que l'application garde dans le navigateur d'une visite à l'autre : le texte du morceau, et le
 * mode (l'éditeur ouvert ou non). Sans stockage (navigation privée…), on fait sans.
 */
import { SAMPLE } from "./sample.ts";

const SOURCE_KEY = "prisma:source";
const EDITING_KEY = "prisma:editing";

/** Le texte de la dernière visite, à défaut l'exemple de départ. */
export function loadSource() {
  try {
    return localStorage.getItem(SOURCE_KEY) ?? SAMPLE;
  } catch {
    return SAMPLE;
  }
}

export function saveSource(text: string) {
  try {
    localStorage.setItem(SOURCE_KEY, text);
  } catch {
    /* stockage indisponible : sans conséquence */
  }
}

/** Le mode de la dernière visite ; à défaut, l'éditeur pour un texte vide, la lecture sinon. */
export function loadEditing(source: string) {
  try {
    const stored = localStorage.getItem(EDITING_KEY);
    if (stored !== null) return stored === "true";
  } catch {
    /* stockage indisponible : le mode se déduit du texte */
  }
  return !source.trim();
}

export function saveEditing(on: boolean) {
  try {
    localStorage.setItem(EDITING_KEY, String(on));
  } catch {
    /* stockage indisponible : sans conséquence */
  }
}
