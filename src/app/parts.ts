/** Noms des parties, pour les choisir à l'écoute : l'instrument, et la main ou le rang de la partie. */
import type { Instrument } from "../core/index.ts";

/** Un instrument à clavier : deux parties, ce sont la main droite et la main gauche. */
const KEYBOARD = /piano|clavier|orgue|clavecin|keyboard|organ|harpsichord/i;

export function partNames(instruments: Instrument[]): string[] {
  const out: string[] = [];
  instruments.forEach((ins, i) => {
    const name = ins.name ?? (instruments.length > 1 ? `Instrument ${i + 1}` : "");
    const hands = ins.parts === 2 && (!ins.name || KEYBOARD.test(ins.name));
    for (let k = 0; k < ins.parts; k++) {
      const part = ins.parts === 1 ? "" : hands ? (k ? "main gauche" : "main droite") : `partie ${k + 1}`;
      out.push(name && part ? `${name} — ${part}` : name || (part ? part[0].toUpperCase() + part.slice(1) : "Partie"));
    }
  });
  return out;
}
