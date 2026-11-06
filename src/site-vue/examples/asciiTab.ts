import { TICKS_PER_BEAT, fretOf, parsePrisma, pitchClass } from "../../core/index.ts";

/**
 * Une partie de cordes en tablature de texte, comme on en trouve en ligne : les cases, dans l'ordre,
 * à intervalles égaux, et les barres de mesure. Rien ne dit combien dure une note.
 */
export function asciiTab(text: string): string {
  const score = parsePrisma(text);
  const strings = score.parts[0].strings!;
  const notes = score.notes.filter((note) => note.staff === 0);
  const starts = [...new Set(notes.map((note) => note.start))].sort((first, second) => first - second);
  const bar = (tick: number) => score.beats[Math.floor(tick / TICKS_PER_BEAT)].barIndex;
  // la corde la plus aiguë s'écrit en minuscule quand elle a le nom de la plus grave
  const names = strings.open.map((midi) => pitchClass(((midi + strings.capo) % 12) + 1, "english"));
  const labels = names.map((name, index) => (index === 0 && name === names[names.length - 1] ? name.toLowerCase() : name));
  const width = Math.max(...labels.map((line) => line.length));
  const lines = labels.map((label) => label.padEnd(width) + "|");
  starts.forEach((start, index) => {
    if (index > 0 && bar(start) !== bar(starts[index - 1])) lines.forEach((_, lineIndex) => (lines[lineIndex] += "-|"));
    const here = notes.filter((note) => note.start === start);
    const cells = lines.map((_, stringIndex) => {
      const note = here.find((candidate) => candidate.string === stringIndex + 1);
      return note ? String(fretOf(strings, stringIndex + 1, note.midi)) : "";
    });
    const cellWidth = Math.max(1, ...cells.map((cell) => cell.length));
    lines.forEach((_, stringIndex) => (lines[stringIndex] += "-" + cells[stringIndex].padEnd(cellWidth, "-") + "-"));
  });
  return lines.map((line) => line + "-|").join("\n");
}
