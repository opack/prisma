import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { octaveTint } from "./colors.ts";
import type { OctaveColors } from "./colors.ts";
import { CLICK_SOUNDS } from "./metronome.ts";
import type { ClickGrid, ClickLevel } from "./performance.ts";
import type { RenderOptions } from "./options.ts";
import type { PieceKey } from "./piece.ts";

/**
 * Panneau des options : un tiroir à droite, sous le bouton engrenage, par-dessus l'aperçu et sans
 * rien pousser. Les réglages sont rangés par onglets ; chacun tient sur une ligne, avec sous lui
 * une courte explication du choix en cours.
 *
 * Deux portées, comme les réglages d'un éditeur de code : les options générales, pour tous les
 * morceaux, et celles de la partition ouverte, qui priment sur elles. Côté partition, seules
 * paraissent les options du rendu (mise en page, octaves, notes) ; chacune y est définie pour la
 * partition ou suit l'option générale.
 */

/** Un choix d'une liste : sa valeur, son nom, et ce qu'il fait. */
type Option<T> = { value: T; label: string; hint: string };

const TABS = [
  { id: "editing", label: "Édition", piece: false },
  { id: "score", label: "Partition", piece: true },
  { id: "octaves", label: "Octaves", piece: true },
  { id: "notes", label: "Notes", piece: true },
  { id: "playback", label: "Lecture", piece: false },
  { id: "metronome", label: "Métronome", piece: false },
] as const;
type Tab = (typeof TABS)[number]["id"];

const CHORDS: Option<RenderOptions["chords"]>[] = [
  { value: "both", label: "Nom et notes", hint: "le nom de l'accord (10:m), avec ses notes Prisma dessous (10 1 5)" },
  { value: "name", label: "Nom", hint: "le nom de l'accord : 10:m, 8/12" },
  { value: "notes", label: "Notes", hint: "les notes Prisma empilées, la basse en bas : 10 1 5" },
];

const CHORD_NAMES: Option<RenderOptions["chordNames"]>[] = [
  { value: "prisma", label: "Prisma", hint: "la fondamentale en nombre, puis la sorte d'accord : 10:m, 8:7, 8/12" },
  { value: "english", label: "Anglais", hint: "le nom anglais, lu par les accompagnateurs : Am, G7, G/B" },
];

const NOTE_NAMES: Option<RenderOptions["noteNames"]>[] = [
  { value: "latin", label: "Do ré mi", hint: "dans la barre de statut de l'éditeur ; le do central est do3" },
  { value: "english", label: "C D E", hint: "dans la barre de statut de l'éditeur, en notation anglaise ; le do central est C4" },
  { value: "keyboard", label: "Clavier", hint: "un petit clavier, la note (ou l'accord) marquée sur ses touches ; le choix de la note d'une case se fait sur un clavier" },
  { value: "none", label: "Aucun", hint: "le numéro Prisma suffit : ni nom ni clavier" },
];

const SOURCE_COLORS: Option<RenderOptions["sourceColors"]>[] = [
  { value: "octaves", label: "Signes et octaves", hint: "les signes en couleur, et chaque ligne de notes sur le fond de son couloir d'octave, comme sur la partition" },
  { value: "signs", label: "Signes", hint: "les barres, les traits, les nuances, les doigtés… en couleur, sur un fond blanc" },
  { value: "none", label: "Aucune", hint: "un texte sobre, d'une seule couleur" },
];

const SECTIONS: Option<RenderOptions["sections"]>[] = [
  { value: "newLine", label: "À la ligne", hint: "chaque section commence une nouvelle ligne, comme les couplets d'une chanson" },
  { value: "inline", label: "À la suite", hint: "une section suit la précédente sur la même ligne, séparée par un blanc : la partition est plus courte" },
];

const SIMILE: Option<RenderOptions["simile"]>[] = [
  { value: "pedals", label: "Pédales", hint: "les pédales qu'il demande, dessinées comme les autres ; le fichier garde la mention" },
  { value: "faded", label: "Pédales atténuées", hint: "les mêmes, en gris clair, pour alléger la page" },
  { value: "text", label: "Mention seule", hint: "« Ped. simile », sans les pédales qu'il demande" },
];

const COLORS: Option<OctaveColors>[] = [
  { value: "none", label: "Blanc et gris", hint: "des bandes alternées, sans couleur" },
  { value: "rainbow", label: "Arc-en-ciel", hint: "une couleur fixe par octave, du violet (grave) au rose (aigu)" },
  { value: "rainbowMixed", label: "Arc-en-ciel mélangé", hint: "les mêmes couleurs dans un ordre mélangé : deux octaves voisines contrastent davantage" },
  { value: "muted", label: "Feutré", hint: "des teintes douces et discrètes, dans l'ordre" },
  { value: "mutedMixed", label: "Feutré mélangé", hint: "les teintes feutrées dans un ordre mélangé" },
];

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

/** Une ligne de réglage : son nom, la commande, puis l'explication, et sa portée. */
function Row({ label, htmlFor, hint, scope, children }: { label: string; htmlFor?: string; hint?: ReactNode; scope?: Scope; children: ReactNode }) {
  return (
    <div className={"setting" + (scope?.mark ? ` ${scope.mark}` : "")}>
      <label className="setting-label" htmlFor={htmlFor}>
        {label}
      </label>
      <div className="setting-control">{children}</div>
      {hint && <p className="setting-hint">{hint}</p>}
      {scope?.line}
    </div>
  );
}

/** Ce qu'une ligne montre de sa portée : une marque (« own » : définie pour la partition) et une ligne d'actions. */
type Scope = { mark?: string; line?: ReactNode };

/** Les options de la partition ouverte, à côté des générales. */
export type PieceOptions = {
  general: RenderOptions;
  /** Les options définies pour la partition (elles priment sur les générales). */
  own: Partial<RenderOptions>;
  setGeneral: (patch: Partial<RenderOptions>) => void;
  setPiece: (patch: Partial<RenderOptions>) => void;
  /** Retire des options de la partition : les générales font alors foi. */
  unsetPiece: (keys: PieceKey[]) => void;
  /** Le nom de la partition. */
  name: string;
  /** Le fichier où elles s'enregistrent, à côté de la partition ; null : gardées le temps qu'elle est ouverte. */
  where: string | null;
  keys: readonly PieceKey[];
};

type Portee = "general" | "piece";
const SCOPE_KEY = "prisma:options-scope";

/** Un choix dans une liste déroulante, avec l'explication du choix en cours. */
function Choice<T extends string>({ id, label, value, options, onChange, icon, scope }: { id: string; label: string; value: T; options: Option<T>[]; onChange: (v: T) => void; icon?: (v: T) => ReactNode; scope?: Scope }) {
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <Row label={label} htmlFor={id} hint={current.hint} scope={scope}>
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

function Check({ id, label, text, checked, onChange, hint, scope }: { id: string; label: string; text: string; checked: boolean; onChange: (v: boolean) => void; hint?: string; scope?: Scope }) {
  return (
    <Row label={label} hint={hint} scope={scope}>
      <label className="check">
        <input type="checkbox" id={id} checked={checked} onChange={(e) => onChange(e.target.checked)} />
        {text}
      </label>
    </Row>
  );
}

/** Le drapeau d'une palette : les octaves empilées, de l'aigu (en haut) au grave. */
function Flag({ colors }: { colors: OctaveColors }) {
  const stripes = Array.from({ length: 9 }, (_, k) => 4 - k).map((offset, k) => octaveTint(colors, offset)?.tab ?? (k % 2 ? "#ffffff" : "#e6e8e3"));
  return (
    <svg className="flag" viewBox="0 0 24 18" preserveAspectRatio="none" aria-hidden>
      {stripes.map((c, k) => (
        <rect key={k} x={0} y={k * 2} width={24} height={2} fill={c} />
      ))}
      <rect x={0.25} y={0.25} width={23.5} height={17.5} fill="none" stroke="#c9cdd1" strokeWidth={0.5} rx={1.5} />
    </svg>
  );
}

const labelOf = <T extends string>(list: { value: T; label: string }[], v: T) => list.find((o) => o.value === v)?.label ?? v;

/** Le nom, en clair, de la valeur d'une option du rendu (pour dire celle de l'autre portée). */
const DESCRIBE: Record<string, (o: RenderOptions) => string> = {
  chords: (o) => labelOf(CHORDS, o.chords),
  chordNames: (o) => labelOf(CHORD_NAMES, o.chordNames),
  namesEverySystem: (o) => (o.namesEverySystem ? "à chaque système" : "au premier système"),
  sections: (o) => labelOf(SECTIONS, o.sections),
  simile: (o) => labelOf(SIMILE, o.simile),
  octavePosition: (o) => labelOf(OCTAVE_POSITIONS, o.octavePosition),
  octaveStyle: (o) => labelOf(OCTAVE_SYMBOLS, o.octaveStyle),
  octaveColors: (o) => labelOf(COLORS, o.octaveColors),
  density: (o) => labelOf(DENSITIES, o.density),
  notePosition: (o) => labelOf(NOTE_POSITIONS, o.notePosition),
  holdReminders: (o) => (o.holdReminders ? "rappelée" : "trait seul"),
  fingerings: (o) => (o.fingerings ? "affichés" : "masqués"),
};

export function OptionsDrawer({ piece, onClose }: { piece: PieceOptions; onClose: () => void }) {
  const { general, own } = piece;
  const [portee, setPorteeState] = useState<Portee>(() => {
    try {
      return localStorage.getItem(SCOPE_KEY) === "piece" ? "piece" : "general";
    } catch {
      return "general";
    }
  });
  const setPortee = (p: Portee) => {
    setPorteeState(p);
    try {
      localStorage.setItem(SCOPE_KEY, p);
    } catch {
      /* stockage indisponible : sans conséquence */
    }
  };
  const [tabChoice, setTab] = useState<Tab>(() => {
    try {
      return (TABS.find((t) => t.id === localStorage.getItem("prisma:options-tab"))?.id ?? "score") as Tab;
    } catch {
      return "score";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("prisma:options-tab", tabChoice);
    } catch {
      /* stockage indisponible : sans conséquence */
    }
  }, [tabChoice]);
  const tabs = TABS.filter((t) => portee === "general" || t.piece);
  const tab = tabs.some((t) => t.id === tabChoice) ? tabChoice : "score";

  // les valeurs montrées et ce que change une commande : celles de la portée choisie (côté
  // partition, une option qu'elle ne définit pas montre la générale, qu'elle suit)
  const onPiece = portee === "piece";
  const options: RenderOptions = onPiece ? { ...general, ...own } : general;
  const setOptions = onPiece ? piece.setPiece : piece.setGeneral;
  const isOwn = (keys: PieceKey[]) => keys.every((k) => own[k] !== undefined);
  const same = (keys: PieceKey[]) => keys.every((k) => own[k] === general[k]);
  const pick = (keys: PieceKey[], from: Partial<RenderOptions>) => Object.fromEntries(keys.map((k) => [k, from[k]])) as Partial<RenderOptions>;

  /** La portée d'une ligne : ce qu'en dit l'autre portée, et de quoi passer de l'une à l'autre. */
  const scope = (keys: PieceKey[], describe: string): Scope => {
    const name = DESCRIBE[describe];
    const theirs = (o: Partial<RenderOptions>) => name({ ...general, ...o });
    const link = (text: string, run: () => void, title?: string) => (
      <button className="link" onClick={run} title={title}>
        {text}
      </button>
    );
    if (onPiece) {
      if (!isOwn(keys))
        return {
          mark: "follows",
          line: (
            <p className="setting-scope">
              <span className="muted">option générale</span>
              {link("Définir pour la partition", () => piece.setPiece(pick(keys, general)), "La partition garde cette valeur, quelles que soient les options générales")}
            </p>
          ),
        };
      return {
        mark: "own",
        line: (
          <p className="setting-scope">
            <span className="badge">partition</span>
            {same(keys) ? <span className="muted">comme l'option générale</span> : <span className="muted">générale : {theirs({})}</span>}
            {!same(keys) && link("Appliquer aux générales", () => piece.setGeneral(pick(keys, own)), "Cette valeur devient l'option générale, pour tous les morceaux")}
            {!same(keys) && link("Reprendre la générale", () => piece.setPiece(pick(keys, general)), "La partition prend la valeur de l'option générale, et la garde")}
            {link("Retirer", () => piece.unsetPiece(keys), "Retirer de la partition : elle suit alors l'option générale")}
          </p>
        ),
      };
    }
    // côté général : une partition qui définit sa propre valeur la garde
    if (isOwn(keys) && !same(keys))
      return {
        mark: "overridden",
        line: (
          <p className="setting-scope">
            <span className="badge">partition : {theirs(own)}</span>
            <span className="muted">elle prime sur cette option</span>
            {link("Appliquer à la partition", () => piece.setPiece(pick(keys, general)), "La partition prend cette valeur")}
            {link("Reprendre la sienne", () => piece.setGeneral(pick(keys, own)), "L'option générale prend la valeur de la partition")}
          </p>
        ),
      };
    if (isOwn(keys))
      return {
        line: (
          <p className="setting-scope">
            <span className="badge">partition : idem</span>
          </p>
        ),
      };
    // rien de propre à la partition : l'action ne paraît qu'au survol, pour ne pas encombrer
    return {
      line: <p className="setting-scope quiet">{link("Appliquer à la partition", () => piece.setPiece(pick(keys, general)), "La partition garde cette valeur, quelles que soient les options générales")}</p>,
    };
  };
  const ownCount = Object.keys(own).length;

  return (
    <aside id="options" className="drawer" aria-label="Options">
      <header className="drawer-head">
        <h2>Options</h2>
        <button className="close" onClick={onClose} aria-label="Fermer les options" title="Fermer (Échap)">
          ×
        </button>
      </header>
      <div className="portee" role="radiogroup" aria-label="Portée des options">
        <button role="radio" aria-checked={!onPiece} className={!onPiece ? "on" : undefined} onClick={() => setPortee("general")} title="Les options de tous les morceaux">
          Générales
        </button>
        <button role="radio" aria-checked={onPiece} className={onPiece ? "on" : undefined} onClick={() => setPortee("piece")} title="Les options de la partition ouverte : elles priment sur les générales">
          Partition{ownCount ? ` (${ownCount})` : ""}
        </button>
      </div>
      {onPiece && (
        <div className="piece-head">
          <p className="piece-note">
            <strong>{piece.name}</strong> :{" "}
            {piece.where ? `ses options s'enregistrent à côté d'elle, dans ${piece.where}, et la suivent d'un ordinateur à l'autre.` : "ses options valent le temps qu'elle est ouverte ; ouverte depuis la bibliothèque, elle les garderait à côté d'elle."}
          </p>
          <p className="piece-actions">
            <button className="link" onClick={() => piece.setPiece(pick([...piece.keys], general))} title="Chaque option du rendu est définie pour la partition, avec la valeur générale actuelle">
              Tout définir pour la partition
            </button>
            {ownCount > 0 && (
              <button className="link" onClick={() => piece.unsetPiece([...piece.keys])} title="La partition suit alors toutes les options générales">
                Tout retirer
              </button>
            )}
          </p>
        </div>
      )}
      <nav className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "active" : undefined} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      <div className="drawer-body" role="tabpanel">
        {tab === "editing" && (
          <>
            <Check
              id="auto-engrave"
              label="Mise en page"
              text="Mettre en page automatiquement"
              checked={options.autoEngrave}
              onChange={(autoEngrave) => setOptions({ autoEngrave })}
              hint={options.autoEngrave ? "la mise en page suit la saisie, peu après la dernière frappe" : "on met en page d'un clic sur le bouton en bas de l'éditeur (Ctrl+Entrée)"}
            />
            <Check
              id="score-to-text"
              label="Partition et texte"
              text="Relier la partition et le texte"
              checked={options.scoreToText}
              onChange={(scoreToText) => setOptions({ scoreToText })}
              hint={options.scoreToText ? "un clic sur la partition place le curseur du texte sur le signe cliqué ; le signe sous le curseur du texte est encadré sur la partition" : "le clic sur la partition ne place que l'écoute ; rien n'est encadré"}
            />
            <Choice id="source-colors" label="Coloration" value={options.sourceColors} options={SOURCE_COLORS} onChange={(sourceColors) => setOptions({ sourceColors })} />
            <Choice id="note-names" label="Noms des notes" value={options.noteNames} options={NOTE_NAMES} onChange={(noteNames) => setOptions({ noteNames })} />
          </>
        )}
        {tab === "score" && (
          <>
            <Choice id="chords" label="Accompagnement" value={options.chords} options={CHORDS} onChange={(chords) => setOptions({ chords })} scope={scope(["chords"], "chords")} />
            {options.chords !== "notes" && (
              <Choice
                id="chord-names"
                label="Nom des accords"
                value={options.chordNames}
                options={CHORD_NAMES}
                onChange={(chordNames) => setOptions({ chordNames })}
                scope={scope(["chordNames"], "chordNames")}
              />
            )}
            <Check
              id="names-every-system"
              label="Parties"
              text="Répéter les noms à chaque système"
              checked={options.namesEverySystem}
              onChange={(namesEverySystem) => setOptions({ namesEverySystem })}
              hint={options.namesEverySystem ? "le nom de chaque partie en tête de chaque système" : "les noms au premier système seulement, comme sur une partition"}
              scope={scope(["namesEverySystem"], "namesEverySystem")}
            />
            <Choice id="sections" label="Sections" value={options.sections} options={SECTIONS} onChange={(sections) => setOptions({ sections })} scope={scope(["sections"], "sections")} />
            <Choice id="simile" label="Ped. simile" value={options.simile} options={SIMILE} onChange={(simile) => setOptions({ simile })} scope={scope(["simile"], "simile")} />
          </>
        )}
        {tab === "octaves" && (
          <>
            <Choice id="octave-position" label="Position" value={options.octavePosition} options={OCTAVE_POSITIONS} onChange={(octavePosition) => setOptions({ octavePosition })} scope={scope(["octavePosition"], "octavePosition")} />
            <Choice id="octave-symbol" label="Symbole" value={options.octaveStyle} options={OCTAVE_SYMBOLS} onChange={(octaveStyle) => setOptions({ octaveStyle })} scope={scope(["octaveStyle"], "octaveStyle")} />
            <Choice id="octave-colors" label="Couleurs" value={options.octaveColors} options={COLORS} onChange={(octaveColors) => setOptions({ octaveColors })} icon={(c) => <Flag colors={c} />} scope={scope(["octaveColors"], "octaveColors")} />
          </>
        )}
        {tab === "notes" && (
          <>
            <Choice id="density" label="Espacement" value={options.density} options={DENSITIES} onChange={(density) => setOptions({ density })} scope={scope(["density"], "density")} />
            <Choice id="note-position" label="Position" value={options.notePosition} options={NOTE_POSITIONS} onChange={(notePosition) => setOptions({ notePosition })} scope={scope(["notePosition"], "notePosition")} />
            <Check
              id="hold-reminders"
              label="Tenues"
              text="Rappeler la note tenue en début de ligne"
              checked={options.holdReminders}
              onChange={(holdReminders) => setOptions({ holdReminders })}
              hint={options.holdReminders ? "« — 8 » : le trait de tenue, puis la note tenue en gris" : "le seul trait de tenue"}
              scope={scope(["holdReminders"], "holdReminders")}
            />
            <Check
              id="fingerings"
              label="Doigtés"
              text="Afficher les doigtés"
              checked={options.fingerings}
              onChange={(fingerings) => setOptions({ fingerings })}
              hint={options.fingerings ? "en chiffre blanc sur une pastille, en bas à droite de la note" : "masqués : la page s'allège, le fichier les garde"}
              scope={scope(["fingerings"], "fingerings")}
            />
          </>
        )}
        {tab === "playback" && (
          <>
            <Check
              id="look-ahead"
              label="Système suivant"
              text="Le montrer d'avance"
              checked={options.lookAhead}
              onChange={(lookAhead) => setOptions({ lookAhead })}
              hint={options.lookAhead ? "à l'écoute, dans la dernière mesure d'un système, la page glisse peu à peu pour le montrer" : "à l'écoute, la page ne bouge qu'en arrivant au système suivant"}
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
