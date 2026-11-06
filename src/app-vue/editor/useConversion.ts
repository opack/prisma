/**
 * Partition › Convertir pour la guitare ou la basse : le choix des options d'abord (ConvertDialog),
 * sur les parties du texte, puis le texte réécrit (annulable avec Ctrl+Z), et ce que la conversion
 * a dû changer, dit dans la barre.
 */
import { shallowRef } from "vue";
import type { Ref } from "vue";
import { convertToStrings, parsePrisma, writePrisma } from "../../core/index.ts";
import type { ConversionOptions, Part } from "../../core/index.ts";

const count = (amount: number, word: string) => `${amount} ${word}${amount > 1 ? "s" : ""}`;

export function useConversion(
  source: Ref<string>,
  rewrite: (rewritten: { text: string; line: number; column: number }) => unknown,
  notify: (message: string) => void,
) {
  /** Les parties du texte, le choix ouvert ; null, fermé. */
  const parts = shallowRef<Part[] | null>(null);

  function start() {
    try {
      parts.value = parsePrisma(source.value).parts;
    } catch (error) {
      notify(`Conversion impossible : ${(error as Error).message}`);
    }
  }

  function convert(part: number, conversion: ConversionOptions) {
    parts.value = null;
    try {
      const { score, report } = convertToStrings(parsePrisma(source.value), part, conversion);
      rewrite({ text: writePrisma(score), line: 1, column: 1 });
      const changes = [
        report.octave && conversion.octave === undefined ? "une octave plus bas" : "",
        report.moved ? `${count(report.moved, "note")} ramenée${report.moved > 1 ? "s" : ""} dans la tessiture` : "",
        report.dropped ? `${count(report.dropped, "note")} retirée${report.dropped > 1 ? "s" : ""}` : "",
      ].filter(Boolean);
      notify(`Converti${changes.length ? " : " + changes.join(", ") : ""} (Ctrl+Z pour revenir)`);
    } catch (error) {
      notify(`Conversion impossible : ${(error as Error).message}`);
    }
  }

  return { parts, start, convert, cancel: () => (parts.value = null) };
}
