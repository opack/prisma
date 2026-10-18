/** Noms des portées, pour les choisir à l'écoute : la partie, et la main ou le rang de la portée. */
import type { Part } from "../core/index.ts";

/** Un instrument à clavier : deux portées, ce sont la main droite et la main gauche. */
const KEYBOARD = /piano|clavier|orgue|clavecin|keyboard|organ|harpsichord/i;

export function staffNames(parts: Part[]): string[] {
  const out: string[] = [];
  parts.forEach((part, i) => {
    const name = part.name ?? (parts.length > 1 ? `Partie ${i + 1}` : "");
    const hands = part.staves === 2 && (!part.name || KEYBOARD.test(part.name));
    for (let k = 0; k < part.staves; k++) {
      const staff = part.staves === 1 ? "" : hands ? (k ? "main gauche" : "main droite") : `portée ${k + 1}`;
      out.push(name && staff ? `${name} — ${staff}` : name || (staff ? staff[0].toUpperCase() + staff.slice(1) : "Portée"));
    }
  });
  return out;
}
