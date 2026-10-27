/**
 * Partition › Convertir pour la guitare ou la basse : le choix des options d'abord (ConvertDialog),
 * sur les parties du texte, puis le texte réécrit (annulable avec Ctrl+Z), et ce que la conversion
 * a dû changer, dit dans la barre.
 */
import { useState } from "react";
import type { MutableRefObject } from "react";
import { convertToStrings, parsePrisma, writePrisma } from "../../core/index.ts";
import type { ConversionOptions, Part } from "../../core/index.ts";

const count = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

export function useConversion(current: MutableRefObject<string>, rewrite: (r: { text: string; line: number; column: number }) => boolean, notify: (message: string) => void) {
  const [parts, setParts] = useState<Part[] | null>(null);
  const start = () => {
    try {
      setParts(parsePrisma(current.current).parts);
    } catch (e) {
      notify(`Conversion impossible : ${(e as Error).message}`);
    }
  };
  const convert = (part: number, conversion: ConversionOptions) => {
    setParts(null);
    try {
      const { score, report } = convertToStrings(parsePrisma(current.current), part, conversion);
      rewrite({ text: writePrisma(score), line: 1, column: 1 });
      const changes = [
        report.octave && conversion.octave === undefined ? "une octave plus bas" : "",
        report.moved ? `${count(report.moved, "note")} ramenée${report.moved > 1 ? "s" : ""} dans la tessiture` : "",
        report.dropped ? `${count(report.dropped, "note")} retirée${report.dropped > 1 ? "s" : ""}` : "",
      ].filter(Boolean);
      notify(`Converti${changes.length ? " : " + changes.join(", ") : ""} (Ctrl+Z pour revenir)`);
    } catch (e) {
      notify(`Conversion impossible : ${(e as Error).message}`);
    }
  };
  return { parts, start, convert, cancel: () => setParts(null) };
}
