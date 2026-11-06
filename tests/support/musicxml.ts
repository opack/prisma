/** Petit générateur de MusicXML pour les tests : des mesures décrites en texte compact. */
const STEPS = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"];
const ALTER = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];

export type XNote = {
  midi?: number[];
  duration: number;
  staff?: number;
  voice?: number;
  tie?: ("start" | "stop")[];
  /** XML brut placé juste avant la note (directions : nuances, soufflets, textes). */
  before?: string;
  /** Petite note (dur vaut alors 0) ; « slash » : barrée (acciaccature). */
  grace?: boolean | "slash";
  /** XML brut placé dans <notations> de la note (point d'orgue…). */
  notations?: string;
  /** XML brut des paroles de la note (<lyric>…), sur la première note d'un accord. */
  lyric?: string;
};
export type XMeasure = {
  notes: XNote[][]; // une liste d'événements par voix, jouées en parallèle
  time?: [number, number];
  /** Armure : nombre de dièses (> 0) ou de bémols (< 0). */
  key?: number;
  implicit?: boolean;
  barline?: string; // XML brut à insérer (reprises, cases)
  barlineLeft?: string;
};

export function musicXml(measures: XMeasure[], divisions = 12): string {
  const ms = measures.map((xMeasure, index) => {
    let body = "";
    if (xMeasure.barlineLeft) body += `<barline location="left">${xMeasure.barlineLeft}</barline>`;
    if (index === 0 || xMeasure.time) {
      const [b, t] = xMeasure.time ?? [4, 4];
      const key = xMeasure.key !== undefined ? `<key><fifths>${xMeasure.key}</fifths></key>` : "";
      body += `<attributes>${index === 0 ? `<divisions>${divisions}</divisions><staves>2</staves>` : ""}${key}<time><beats>${b}</beats><beat-type>${t}</beat-type></time></attributes>`;
    }
    xMeasure.notes.forEach((voice, vi) => {
      if (vi) body += `<backup><duration>${xMeasure.notes[vi - 1].reduce((s, xNote) => s + xNote.duration, 0)}</duration></backup>`;
      for (const n of voice) {
        if (n.before) body += n.before;
        const staff =
          `<staff>${n.staff ?? 1}</staff><voice>${n.voice ?? vi + 1}</voice>` +
          (n.notations ? `<notations>${n.notations}</notations>` : "");
        if (!n.midi?.length) {
          body += `<note><rest/><duration>${n.duration}</duration>${staff}</note>`;
          continue;
        }
        n.midi.forEach((p, index) => {
          const pc = p % 12;
          const alt = ALTER[pc] ? `<alter>1</alter>` : "";
          const ties = (n.tie ?? []).map((text) => `<tie type="${text}"/>`).join("");
          const grace = n.grace ? `<grace${n.grace === "slash" ? ' slash="yes"' : ""}/>` : "";
          const dur = n.grace ? "" : `<duration>${n.duration}</duration>`;
          body += `<note>${grace}${index ? "<chord/>" : ""}<pitch><step>${STEPS[pc]}</step>${alt}<octave>${Math.floor(p / 12) - 1}</octave></pitch>${dur}${ties}${staff}${!index && n.lyric ? n.lyric : ""}</note>`;
        });
      }
    });
    if (xMeasure.barline) body += `<barline location="right">${xMeasure.barline}</barline>`;
    return `<measure number="${index + 1}"${xMeasure.implicit ? ' implicit="yes"' : ""}>${body}</measure>`;
  });
  return `<?xml version="1.0"?><score-partwise version="3.1"><work><work-title>Test</work-title></work><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">${ms.join("")}</part></score-partwise>`;
}

export const QUARTER = 12; // noire avec divisions = 12

/** Le do du milieu du clavier, en numéro MIDI. */
export const C4 = 60;
