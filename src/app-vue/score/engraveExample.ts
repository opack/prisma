/**
 * La gravure d'un exemple (la référence, le site) : le texte lu puis gravé tel quel, aux options de
 * mise en page seules (sans pédales déduites d'un « Ped. simile », ni récapitulatif des grilles), ou
 * l'erreur qui l'empêche.
 */
import { alignOf } from "../../app/options/options.ts";
import type { RenderOptions } from "../../app/options/options.ts";
import { engrave } from "../../app/score/engrave.ts";
import type { Page } from "../../app/score/engrave.ts";
import { parsePrisma } from "../../core/index.ts";

export function engraveExample(
  text: string,
  options: RenderOptions,
): { pages: Page[]; error?: undefined } | { pages?: undefined; error: string } {
  try {
    return {
      pages: engrave(parsePrisma(text), {
        compact: options.density === "compact",
        chords: options.chords,
        chordNames: options.chordNames,
        align: alignOf(options.notePosition),
        reminders: options.holdReminders,
        inlineSections: options.sections === "inline",
      }),
    };
  } catch (error) {
    return { error: (error as Error).message };
  }
}
