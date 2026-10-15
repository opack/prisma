import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { octaveTint } from "./colors.ts";
import type { OctavePalette } from "./colors.ts";
import { CLICK_SOUNDS } from "./metronome.ts";
import type { ClickGrid, ClickLevel } from "./performance.ts";
import type { RenderOptions } from "./options.ts";

/**
 * Panneau des options : un tiroir à droite, sous le bouton engrenage, par-dessus l'aperçu et sans
 * rien pousser. Les réglages sont rangés par
 * onglets ; chacun tient sur une ligne, avec sous lui une courte explication du choix en cours.
 */

/** Un choix d'une liste : sa valeur, son nom, et ce qu'il fait. */
type Option<T> = { value: T; label: string; hint: string };

const TABS = [
  { id: "score", label: "Partition" },
  { id: "octaves", label: "Octaves" },
  { id: "notes", label: "Notes" },
  { id: "metronome", label: "Métronome" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const CHORDS: Option<RenderOptions["chords"]>[] = [
  { value: "both", label: "Nom et notes", hint: "le nom anglais (Am), avec les notes ymn dessous (10 1 5)" },
  { value: "name", label: "Nom", hint: "le nom anglais : Am, G/B" },
  { value: "notes", label: "Notes", hint: "les notes ymn empilées, la basse en bas : 10 1 5" },
];

const SECTIONS: Option<RenderOptions["sections"]>[] = [
  { value: "newLine", label: "À la ligne", hint: "chaque section commence une nouvelle ligne, comme les couplets d'une chanson" },
  { value: "inline", label: "À la suite", hint: "une section suit la précédente sur la même ligne, séparée par un blanc : la partition est plus courte" },
];

const SIMILE: Option<RenderOptions["simile"]>[] = [
  { value: "pedals", label: "Pédales", hint: "les pédales qu'il demande, gravées comme les autres ; le fichier garde la mention" },
  { value: "faded", label: "Pédales atténuées", hint: "les mêmes, en gris clair, pour alléger la page" },
  { value: "text", label: "Mention seule", hint: "« Ped. simile », sans les pédales qu'il demande" },
];

/** Couleurs des octaves : la palette et son ordre, réunis en un seul choix. */
type Colors = "none" | "rainbow" | "rainbow-mixed" | "muted" | "muted-mixed";
const COLORS: Option<Colors>[] = [
  { value: "none", label: "Blanc et gris", hint: "des bandes alternées, sans couleur" },
  { value: "rainbow", label: "Arc-en-ciel", hint: "une couleur fixe par octave, du violet (grave) au rose (aigu)" },
  { value: "rainbow-mixed", label: "Arc-en-ciel mélangé", hint: "les mêmes couleurs dans un ordre mélangé : deux octaves voisines contrastent davantage" },
  { value: "muted", label: "Feutré", hint: "des teintes douces et discrètes, dans l'ordre" },
  { value: "muted-mixed", label: "Feutré mélangé", hint: "les teintes feutrées dans un ordre mélangé" },
];
const colorsOf = (o: RenderOptions): Colors => (o.octavePalette === "none" ? "none" : `${o.octavePalette}${o.octaveMixed ? "-mixed" : ""}` as Colors);
const paletteOf = (c: Colors): Pick<RenderOptions, "octavePalette" | "octaveMixed"> =>
  c === "none" ? { octavePalette: "none", octaveMixed: false } : { octavePalette: c.replace("-mixed", "") as OctavePalette, octaveMixed: c.endsWith("-mixed") };

const OCTAVE_SYMBOLS: Option<RenderOptions["octaveStyle"]>[] = [
  { value: "triangle", label: "Triangles", hint: "▲1  0  ▼1" },
  { value: "arrow", label: "Flèches", hint: "↑1  0  ↓1" },
  { value: "sign", label: "Signes", hint: "+1  0  −1" },
];

const OCTAVE_POSITIONS: Option<RenderOptions["octavePosition"]>[] = [
  { value: "top", label: "En haut", hint: "le numéro en face de la première ligne de son octave" },
  { value: "center", label: "Au centre", hint: "le numéro au milieu de son octave" },
];

const NOTE_POSITIONS: Option<RenderOptions["notePosition"]>[] = [
  { value: "top", label: "En haut", hint: "les notes en haut de leur couloir d'octave" },
  { value: "center", label: "Centrées", hint: "chaque groupe de notes centré dans son couloir" },
  { value: "aligned", label: "Alignées", hint: "une note rejouée garde sa ligne, pour la suivre des yeux" },
  { value: "pitch", label: "Une ligne par note", hint: "alignées, et deux notes d'une même mesure sur deux lignes, l'aiguë au-dessus : le dessin des arpèges et de la mélodie" },
];

const DENSITIES: Option<RenderOptions["density"]>[] = [
  { value: "normal", label: "Normal", hint: "des cases larges, plus lisibles" },
  { value: "compact", label: "Compact", hint: "des cases serrées, pour les partitions chargées" },
];

const GRIDS: Option<ClickGrid>[] = [
  { value: "cells", label: "Cases écrites", hint: "un coup par case écrite : il fait entendre quand jouer" },
  { value: "attacks", label: "Attaques", hint: "seulement là où une note commence : ni les tenues, ni les silences" },
  { value: "beats", label: "Temps et divisions", hint: "une grille régulière, quelles que soient les cases écrites" },
];

const CLICK_LEVELS: { value: ClickLevel; label: string; hint: string }[] = [
  { value: "downbeat", label: "Premier temps", hint: "le 1 de la mesure" },
  { value: "beat", label: "Temps", hint: "1, 2, 3…" },
  { value: "division", label: "Division", hint: "le temps en 2 (ou en 3) : *" },
  { value: "subdivision", label: "Subdivision", hint: "chaque division en 2 : ." },
];

/** Une ligne de réglage : son nom, la commande, puis l'explication. */
function Row({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="setting">
      <label className="setting-label" htmlFor={htmlFor}>
        {label}
      </label>
      <div className="setting-control">{children}</div>
      {hint && <p className="setting-hint">{hint}</p>}
    </div>
  );
}

/** Un choix dans une liste déroulante, avec l'explication du choix en cours. */
function Choice<T extends string>({ id, label, value, options, onChange, icon }: { id: string; label: string; value: T; options: Option<T>[]; onChange: (v: T) => void; icon?: (v: T) => ReactNode }) {
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <Row label={label} htmlFor={id} hint={current.hint}>
      {icon?.(current.value)}
      <select id={id} value={current.value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Row>
  );
}

function Check({ id, label, text, checked, onChange, hint }: { id: string; label: string; text: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <Row label={label} hint={hint}>
      <label className="check">
        <input type="checkbox" id={id} checked={checked} onChange={(e) => onChange(e.target.checked)} />
        {text}
      </label>
    </Row>
  );
}

/** Le drapeau d'une palette : les octaves empilées, de l'aigu (en haut) au grave. */
function Flag({ colors }: { colors: Colors }) {
  const { octavePalette, octaveMixed } = paletteOf(colors);
  const stripes = Array.from({ length: 9 }, (_, k) => 4 - k).map((offset, k) => octaveTint(octavePalette, octaveMixed, offset)?.tab ?? (k % 2 ? "#ffffff" : "#e6e8e3"));
  return (
    <svg className="flag" viewBox="0 0 24 18" preserveAspectRatio="none" aria-hidden>
      {stripes.map((c, k) => (
        <rect key={k} x={0} y={k * 2} width={24} height={2} fill={c} />
      ))}
      <rect x={0.25} y={0.25} width={23.5} height={17.5} fill="none" stroke="#c9cdd1" strokeWidth={0.5} rx={1.5} />
    </svg>
  );
}

export function OptionsDrawer({ options, setOptions, onClose }: { options: RenderOptions; setOptions: (patch: Partial<RenderOptions>) => void; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>(() => {
    try {
      return (TABS.find((t) => t.id === localStorage.getItem("ymn:options-tab"))?.id ?? "score") as Tab;
    } catch {
      return "score";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("ymn:options-tab", tab);
    } catch {
      /* stockage indisponible : sans conséquence */
    }
  }, [tab]);

  return (
    <aside id="options" className="drawer" aria-label="Options">
      <header className="drawer-head">
        <h2>Options</h2>
        <button className="close" onClick={onClose} aria-label="Fermer les options" title="Fermer (Échap)">
          ×
        </button>
      </header>
      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "active" : undefined} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      <div className="drawer-body" role="tabpanel">
        {tab === "score" && (
          <>
            <Check
              id="auto-engrave"
              label="Gravure"
              text="Graver automatiquement"
              checked={options.autoEngrave}
              onChange={(autoEngrave) => setOptions({ autoEngrave })}
              hint={options.autoEngrave ? "la gravure suit la saisie, peu après la dernière frappe" : "on grave d'un clic sur le bouton Graver, en bas de l'éditeur (Ctrl+Entrée)"}
            />
            <Choice id="chords" label="Accompagnement" value={options.chords} options={CHORDS} onChange={(chords) => setOptions({ chords })} />
            <Check
              id="names-every-system"
              label="Instruments"
              text="Répéter les noms à chaque système"
              checked={options.namesEverySystem}
              onChange={(namesEverySystem) => setOptions({ namesEverySystem })}
              hint={options.namesEverySystem ? "le nom de chaque instrument en tête de chaque système" : "les noms au premier système seulement, comme sur une partition"}
            />
            <Choice id="sections" label="Sections" value={options.sections} options={SECTIONS} onChange={(sections) => setOptions({ sections })} />
            <Choice id="simile" label="Ped. simile" value={options.simile} options={SIMILE} onChange={(simile) => setOptions({ simile })} />
          </>
        )}
        {tab === "octaves" && (
          <>
            <Choice id="octave-position" label="Position" value={options.octavePosition} options={OCTAVE_POSITIONS} onChange={(octavePosition) => setOptions({ octavePosition })} />
            <Choice id="octave-symbol" label="Symbole" value={options.octaveStyle} options={OCTAVE_SYMBOLS} onChange={(octaveStyle) => setOptions({ octaveStyle })} />
            <Choice id="octave-colors" label="Couleurs" value={colorsOf(options)} options={COLORS} onChange={(c) => setOptions(paletteOf(c))} icon={(c) => <Flag colors={c} />} />
          </>
        )}
        {tab === "notes" && (
          <>
            <Choice id="density" label="Espacement" value={options.density} options={DENSITIES} onChange={(density) => setOptions({ density })} />
            <Choice id="note-position" label="Position" value={options.notePosition} options={NOTE_POSITIONS} onChange={(notePosition) => setOptions({ notePosition })} />
            <Check
              id="hold-reminders"
              label="Tenues"
              text="Rappeler la note tenue en début de ligne"
              checked={options.holdReminders}
              onChange={(holdReminders) => setOptions({ holdReminders })}
              hint={options.holdReminders ? "« — 8 » : le trait de tenue, puis la note tenue en gris" : "le seul trait de tenue"}
            />
            <Check
              id="fingerings"
              label="Doigtés"
              text="Afficher les doigtés"
              checked={options.fingerings}
              onChange={(fingerings) => setOptions({ fingerings })}
              hint={options.fingerings ? "en chiffre blanc sur une pastille, en bas à droite de la note" : "masqués : la page s'allège, le fichier les garde"}
            />
          </>
        )}
        {tab === "metronome" && (
          <>
            <Row label="Volume" htmlFor="click-volume" hint="par rapport aux instruments">
              <input type="range" className="slider" id="click-volume" min={0} max={2} step={0.1} value={options.clickVolume} onChange={(e) => setOptions({ clickVolume: Number(e.target.value) })} aria-valuetext={`${Math.round(options.clickVolume * 100)} %`} />
              <span className="slider-value">{Math.round(options.clickVolume * 100)} %</span>
            </Row>
            <Check id="count-in" label="Décompte" text="Une mesure avant de jouer" checked={options.countIn} onChange={(countIn) => setOptions({ countIn })} hint="au départ et à la reprise, même métronome coupé" />
            <Choice id="click-grid" label="Battre" value={options.clickGrid} options={GRIDS} onChange={(clickGrid) => setOptions({ clickGrid })} />
            {CLICK_LEVELS.map((l) => {
              const index = CLICK_SOUNDS.findIndex((c) => c.value === options.clickSounds[l.value]);
              return (
                <Row key={l.value} label={l.label} htmlFor={"click-" + l.value} hint={l.hint}>
                  {/* du silence au plus aigu : un curseur, plus parlant qu'une liste pour cinq crans */}
                  <input
                    type="range"
                    className="slider"
                    id={"click-" + l.value}
                    min={0}
                    max={CLICK_SOUNDS.length - 1}
                    step={1}
                    value={index}
                    onChange={(e) => setOptions({ clickSounds: { ...options.clickSounds, [l.value]: CLICK_SOUNDS[Number(e.target.value)].value } })}
                    aria-valuetext={CLICK_SOUNDS[index]?.label}
                  />
                  <span className="slider-value">{CLICK_SOUNDS[index]?.label}</span>
                </Row>
              );
            })}
          </>
        )}
      </div>
    </aside>
  );
}
