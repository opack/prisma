/** Petit générateur de MusicXML pour les tests : des mesures décrites en texte compact. */
const STEPS = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"];
const ALTER = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];

export type XNote = {
  midi?: number[];
  dur: number;
  staff?: number;
  voice?: number;
  tie?: ("start" | "stop")[];
  /** XML brut placé juste avant la note (directions : nuances, soufflets, textes). */
  before?: string;
};
export type XMeasure = {
  notes: XNote[][]; // une liste d'événements par voix, jouées en parallèle
  time?: [number, number];
  implicit?: boolean;
  barline?: string; // XML brut à insérer (reprises, cases)
  barlineLeft?: string;
};

export function musicXml(measures: XMeasure[], divisions = 12): string {
  const ms = measures.map((m, i) => {
    let body = "";
    if (m.barlineLeft) body += `<barline location="left">${m.barlineLeft}</barline>`;
    if (i === 0 || m.time) {
      const [b, t] = m.time ?? [4, 4];
      body += `<attributes>${i === 0 ? `<divisions>${divisions}</divisions><staves>2</staves>` : ""}<time><beats>${b}</beats><beat-type>${t}</beat-type></time></attributes>`;
    }
    m.notes.forEach((voice, vi) => {
      if (vi) body += `<backup><duration>${m.notes[vi - 1].reduce((s, n) => s + n.dur, 0)}</duration></backup>`;
      for (const n of voice) {
        if (n.before) body += n.before;
        const staff = `<staff>${n.staff ?? 1}</staff><voice>${n.voice ?? vi + 1}</voice>`;
        if (!n.midi?.length) {
          body += `<note><rest/><duration>${n.dur}</duration>${staff}</note>`;
          continue;
        }
        n.midi.forEach((p, k) => {
          const pc = p % 12;
          const alt = ALTER[pc] ? `<alter>1</alter>` : "";
          const ties = (n.tie ?? []).map((t) => `<tie type="${t}"/>`).join("");
          body += `<note>${k ? "<chord/>" : ""}<pitch><step>${STEPS[pc]}</step>${alt}<octave>${Math.floor(p / 12) - 1}</octave></pitch><duration>${n.dur}</duration>${ties}${staff}</note>`;
        });
      }
    });
    if (m.barline) body += `<barline location="right">${m.barline}</barline>`;
    return `<measure number="${i + 1}"${m.implicit ? ' implicit="yes"' : ""}>${body}</measure>`;
  });
  return `<?xml version="1.0"?><score-partwise version="3.1"><work><work-title>Test</work-title></work><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">${ms.join("")}</part></score-partwise>`;
}

export const q = 12; // noire avec divisions = 12
