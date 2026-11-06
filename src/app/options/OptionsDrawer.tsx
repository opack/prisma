import { useEffect, useState } from "react";
import { Button } from "../ui/button/Button.tsx";
import type { ReactNode } from "react";
import { octaveTint } from "../score/colors.ts";
import type { OctaveColors } from "../score/colors.ts";
import { CLICK_SOUNDS } from "../playback/metronome.ts";
import type { ClickLevel } from "../playback/performance.ts";
import { CLICK_GRIDS } from "./options.ts";
import type { RenderOptions } from "./options.ts";

/** La ligne de portée d'une option, sous son explication : générale, de la partition, et les actions. */
const SCOPE = "col-start-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 mt-1 mb-0 text-[0.9em] text-muted";
const BADGE = "inline-block px-1.5 rounded-[8px] bg-accent-14 text-accent text-[0.85em] font-semibold whitespace-nowrap";
/** Une action en lien : Définir pour la partition, Retirer… */
const LINK = "p-0 text-accent underline bg-transparent border-0 cursor-pointer";
const SLIDER = "flex-1 min-w-0 accent-accent";
/** Générales, Partition : le choix de la portée des options. */
const porteeButton = (on: boolean) =>
  `flex-1 px-2 py-1.5 border-0 rounded-none ${on ? "bg-accent-12 text-accent font-semibold" : "bg-white text-muted"}`;
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
  {
    value: "grid",
    label: "Nom et grille",
    hint: "le nom de l'accord, avec sa grille pour la guitare : celle écrite (10:m=x02210), sinon la plus simple",
  },
];

const CHORD_NAMES: Option<RenderOptions["chordNames"]>[] = [
  { value: "prisma", label: "Prisma", hint: "la fondamentale en nombre, puis la sorte d'accord : 10:m, 8:7, 8/12" },
  { value: "english", label: "Anglais", hint: "le nom anglais, lu par les accompagnateurs : Am, G7, G/B" },
];

const NOTE_NAMES: Option<RenderOptions["noteNames"]>[] = [
  { value: "latin", label: "Do ré mi", hint: "dans la barre de statut de l'éditeur ; le do central est do3" },
  { value: "english", label: "C D E", hint: "dans la barre de statut de l'éditeur, en notation anglaise ; le do central est C4" },
  {
    value: "keyboard",
    label: "Clavier",
    hint: "un petit clavier, la note (ou l'accord) marquée sur ses touches ; le choix de la note d'une case se fait sur un clavier",
  },
  { value: "none", label: "Aucun", hint: "le numéro Prisma suffit : ni nom ni clavier" },
];

const SOURCE_COLORS: Option<RenderOptions["sourceColors"]>[] = [
  {
    value: "octaves",
    label: "Signes et octaves",
    hint: "les signes en couleur, et chaque ligne de notes sur le fond de son couloir d'octave, comme sur la partition",
  },
  { value: "signs", label: "Signes", hint: "les barres, les traits, les nuances, les doigtés… en couleur, sur un fond blanc" },
  { value: "none", label: "Aucune", hint: "un texte sobre, d'une seule couleur" },
];

const SECTIONS: Option<RenderOptions["sections"]>[] = [
  { value: "newLine", label: "À la ligne", hint: "chaque section commence une nouvelle ligne, comme les couplets d'une chanson" },
  {
    value: "inline",
    label: "À la suite",
    hint: "une section suit la précédente sur la même ligne, séparée par un blanc : la partition est plus courte",
  },
];

const SIMILE: Option<RenderOptions["simile"]>[] = [
  { value: "pedals", label: "Pédales", hint: "les pédales qu'il demande, dessinées comme les autres ; le fichier garde la mention" },
  { value: "faded", label: "Pédales atténuées", hint: "les mêmes, en gris clair, pour alléger la page" },
  { value: "text", label: "Mention seule", hint: "« Ped. simile », sans les pédales qu'il demande" },
];

const COLORS: Option<OctaveColors>[] = [
  { value: "none", label: "Blanc et gris", hint: "des bandes alternées, sans couleur" },
  { value: "rainbow", label: "Arc-en-ciel", hint: "une couleur fixe par octave, du violet (grave) au rose (aigu)" },
  {
    value: "rainbowMixed",
    label: "Arc-en-ciel mélangé",
    hint: "les mêmes couleurs dans un ordre mélangé : deux octaves voisines contrastent davantage",
  },
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
  {
    value: "pitch",
    label: "Une ligne par note",
    hint: "alignées, et deux notes d'une même mesure sur deux lignes, l'aiguë au-dessus : le dessin des arpèges et de la mélodie",
  },
];

const RULER_DETAILS: Option<RenderOptions["rulerDetail"]>[] = [
  { value: "written", label: "Telle qu'écrite", hint: "les cases écrites dans le texte, sans plus" },
  {
    value: "division",
    label: "Premier découpage",
    hint: "chaque temps coupé au moins en 2 (en 3 s'il est ternaire), même sans attaque : 1 * 2 *",
  },
  {
    value: "subdivision",
    label: "Second découpage",
    hint: "chaque temps coupé au moins en 4 (en 6 s'il est ternaire), même sans attaque : 1 . * . 2 . * . ; la partition s'allonge",
  },
];

const DENSITIES: Option<RenderOptions["density"]>[] = [
  { value: "normal", label: "Normal", hint: "des cases larges, plus lisibles" },
  { value: "compact", label: "Compact", hint: "des cases serrées, pour les partitions chargées" },
];

const CLICK_LEVELS: { value: ClickLevel; label: string; hint: string }[] = [
  { value: "downbeat", label: "Premier temps", hint: "le 1 de la mesure" },
  { value: "beat", label: "Temps", hint: "1, 2, 3…" },
  { value: "division", label: "Division", hint: "le temps en 2 (ou en 3) : *" },
  { value: "subdivision", label: "Subdivision", hint: "chaque division en 2 : ." },
];

/** Une ligne de réglage : son nom, la commande, puis l'explication, et sa portée. */
function Row({
  label,
  htmlFor,
  hint,
  scope,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  scope?: Scope;
  children: ReactNode;
}) {
  return (
    <div className="group grid grid-cols-[8.5em_1fr] items-center gap-x-3 gap-y-0.5 py-2.5 border-b border-[#ecece8] last:border-b-0">
      <label className={`font-semibold ${scope?.mark === "own" || scope?.mark === "overridden" ? "text-accent" : ""}`} htmlFor={htmlFor}>
        {label}
      </label>
      <div className={`flex items-center gap-2 min-w-0 ${scope?.mark === "follows" ? "opacity-75" : ""}`}>{children}</div>
      {hint && <p className="col-start-2 m-0 text-muted text-[0.9em] leading-[1.35]">{hint}</p>}
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
function Choice<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  icon,
  scope,
}: {
  id: string;
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  icon?: (v: T) => ReactNode;
  scope?: Scope;
}) {
  const current = options.find((option) => option.value === value) ?? options[0];
  return (
    <Row label={label} htmlFor={id} hint={current.hint} scope={scope}>
      {icon?.(current.value)}
      <select
        className="flex-1 min-w-0 px-1.5 py-1 bg-white border border-line rounded"
        id={id}
        value={current.value}
        onChange={(changeEvent) => onChange(changeEvent.target.value as T)}
      >
        {options.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    </Row>
  );
}

function Check({
  id,
  label,
  text,
  checked,
  onChange,
  hint,
  scope,
}: {
  id: string;
  label: string;
  text: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
  scope?: Scope;
}) {
  return (
    <Row label={label} hint={hint} scope={scope}>
      <label className="inline-flex items-center gap-1.5 cursor-pointer">
        <input type="checkbox" id={id} checked={checked} onChange={(changeEvent) => onChange(changeEvent.target.checked)} />
        {text}
      </label>
    </Row>
  );
}

/** Le drapeau d'une palette : les octaves empilées, de l'aigu (en haut) au grave. */
function Flag({ colors }: { colors: OctaveColors }) {
  const stripes = Array.from({ length: 9 }, (_, index) => 4 - index).map(
    (offset, index) => octaveTint(colors, offset)?.tab ?? (index % 2 ? "#ffffff" : "#e6e8e3"),
  );
  return (
    <svg className="flex-none w-[38px] h-7" viewBox="0 0 24 18" preserveAspectRatio="none" aria-hidden>
      {stripes.map((tint, index) => (
        <rect key={index} x={0} y={index * 2} width={24} height={2} fill={tint} />
      ))}
      <rect x={0.25} y={0.25} width={23.5} height={17.5} fill="none" stroke="#c9cdd1" strokeWidth={0.5} rx={1.5} />
    </svg>
  );
}

const labelOf = <T extends string>(list: { value: T; label: string }[], value: T) =>
  list.find((option) => option.value === value)?.label ?? value;

/** Le nom, en clair, de la valeur d'une option du rendu (pour dire celle de l'autre portée). */
const DESCRIBE: Record<string, (renderOptions: RenderOptions) => string> = {
  chords: (renderOptions) => labelOf(CHORDS, renderOptions.chords),
  chordNames: (renderOptions) => labelOf(CHORD_NAMES, renderOptions.chordNames),
  namesEverySystem: (renderOptions) => (renderOptions.namesEverySystem ? "à chaque système" : "au premier système"),
  sections: (renderOptions) => labelOf(SECTIONS, renderOptions.sections),
  simile: (renderOptions) => labelOf(SIMILE, renderOptions.simile),
  octavePosition: (renderOptions) => labelOf(OCTAVE_POSITIONS, renderOptions.octavePosition),
  octaveStyle: (renderOptions) => labelOf(OCTAVE_SYMBOLS, renderOptions.octaveStyle),
  octaveColors: (renderOptions) => labelOf(COLORS, renderOptions.octaveColors),
  density: (renderOptions) => labelOf(DENSITIES, renderOptions.density),
  rulerDetail: (renderOptions) => labelOf(RULER_DETAILS, renderOptions.rulerDetail),
  notePosition: (renderOptions) => labelOf(NOTE_POSITIONS, renderOptions.notePosition),
  holdReminders: (renderOptions) => (renderOptions.holdReminders ? "rappelée" : "trait seul"),
  fingerings: (renderOptions) => (renderOptions.fingerings ? "affichés" : "masqués"),
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
  const setPortee = (next: Portee) => {
    setPorteeState(next);
    try {
      localStorage.setItem(SCOPE_KEY, next);
    } catch {
      /* stockage indisponible : sans conséquence */
    }
  };
  const [tabChoice, setTab] = useState<Tab>(() => {
    try {
      return (TABS.find((item) => item.id === localStorage.getItem("prisma:options-tab"))?.id ?? "score") as Tab;
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
  const tabs = TABS.filter((item) => portee === "general" || item.piece);
  const tab = tabs.some((item) => item.id === tabChoice) ? tabChoice : "score";

  // les valeurs montrées et ce que change une commande : celles de la portée choisie (côté
  // partition, une option qu'elle ne définit pas montre la générale, qu'elle suit)
  const onPiece = portee === "piece";
  const options: RenderOptions = onPiece ? { ...general, ...own } : general;
  const setOptions = onPiece ? piece.setPiece : piece.setGeneral;
  const isOwn = (keys: PieceKey[]) => keys.every((key) => own[key] !== undefined);
  const same = (keys: PieceKey[]) => keys.every((key) => own[key] === general[key]);
  const pick = (keys: PieceKey[], from: Partial<RenderOptions>) =>
    Object.fromEntries(keys.map((key) => [key, from[key]])) as Partial<RenderOptions>;

  /** La portée d'une ligne : ce qu'en dit l'autre portée, et de quoi passer de l'une à l'autre. */
  const scope = (keys: PieceKey[], describe: string): Scope => {
    const name = DESCRIBE[describe];
    const theirs = (values: Partial<RenderOptions>) => name({ ...general, ...values });
    const link = (text: string, run: () => void, title?: string) => (
      <button className={LINK} onClick={run} title={title}>
        {text}
      </button>
    );
    if (onPiece) {
      if (!isOwn(keys))
        return {
          mark: "follows",
          line: (
            <p className={SCOPE}>
              <span className="text-muted">option générale</span>
              {link(
                "Définir pour la partition",
                () => piece.setPiece(pick(keys, general)),
                "La partition garde cette valeur, quelles que soient les options générales",
              )}
            </p>
          ),
        };
      return {
        mark: "own",
        line: (
          <p className={SCOPE}>
            <span className={BADGE}>partition</span>
            {same(keys) ? (
              <span className="text-muted">comme l'option générale</span>
            ) : (
              <span className="text-muted">générale : {theirs({})}</span>
            )}
            {!same(keys) &&
              link(
                "Appliquer aux générales",
                () => piece.setGeneral(pick(keys, own)),
                "Cette valeur devient l'option générale, pour tous les morceaux",
              )}
            {!same(keys) &&
              link(
                "Reprendre la générale",
                () => piece.setPiece(pick(keys, general)),
                "La partition prend la valeur de l'option générale, et la garde",
              )}
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
          <p className={SCOPE}>
            <span className={BADGE}>partition : {theirs(own)}</span>
            <span className="text-muted">elle prime sur cette option</span>
            {link("Appliquer à la partition", () => piece.setPiece(pick(keys, general)), "La partition prend cette valeur")}
            {link("Reprendre la sienne", () => piece.setGeneral(pick(keys, own)), "L'option générale prend la valeur de la partition")}
          </p>
        ),
      };
    if (isOwn(keys))
      return {
        line: (
          <p className={SCOPE}>
            <span className={BADGE}>partition : idem</span>
          </p>
        ),
      };
    // rien de propre à la partition : l'action ne paraît qu'au survol, pour ne pas encombrer
    return {
      line: (
        <p className="invisible col-start-1 row-start-2 self-start m-0 text-muted text-[0.8em] leading-[1.3] group-hover:visible group-focus-within:visible">
          {link(
            "Appliquer à la partition",
            () => piece.setPiece(pick(keys, general)),
            "La partition garde cette valeur, quelles que soient les options générales",
          )}
        </p>
      ),
    };
  };
  const ownCount = Object.keys(own).length;

  return (
    <aside
      id="options"
      data-drawer
      className="print:hidden! absolute top-0 right-0 bottom-0 z-15 flex flex-col w-[min(440px,100%)] bg-panel border-l border-line shadow-[-8px_0_24px_rgba(0,0,0,0.08)]"
      aria-label="Options"
    >
      <header className="flex items-center justify-between px-4 pt-3 pb-1">
        <h2 className="m-0 text-[1rem]">Options</h2>
        <Button kind="quiet" size="icon" onClick={onClose} aria-label="Fermer les options" title="Fermer (Échap)">
          ×
        </Button>
      </header>
      <div className="flex mx-3 mt-0 mb-2 overflow-hidden border border-line rounded-md" role="radiogroup" aria-label="Portée des options">
        <button
          role="radio"
          aria-checked={!onPiece}
          className={porteeButton(!onPiece)}
          onClick={() => setPortee("general")}
          title="Les options de tous les morceaux"
        >
          Générales
        </button>
        <button
          role="radio"
          aria-checked={onPiece}
          className={`${porteeButton(onPiece)} border-l border-line`}
          onClick={() => setPortee("piece")}
          title="Les options de la partition ouverte : elles priment sur les générales"
        >
          Partition{ownCount ? ` (${ownCount})` : ""}
        </button>
      </div>
      {onPiece && (
        <div className="mx-3 mt-0 mb-1.5">
          <p className="mt-0 mb-0.5 text-[0.9em] text-muted leading-[1.4] wrap-anywhere">
            <strong>{piece.name}</strong> :{" "}
            {piece.where
              ? `ses options s'enregistrent à côté d'elle, dans ${piece.where}, et la suivent d'un ordinateur à l'autre.`
              : "ses options valent le temps qu'elle est ouverte ; ouverte depuis la bibliothèque, elle les garderait à côté d'elle."}
          </p>
          <p className="flex gap-3 m-0 text-[0.9em]">
            <button
              className={LINK}
              onClick={() => piece.setPiece(pick([...piece.keys], general))}
              title="Chaque option du rendu est définie pour la partition, avec la valeur générale actuelle"
            >
              Tout définir pour la partition
            </button>
            {ownCount > 0 && (
              <button
                className={LINK}
                onClick={() => piece.unsetPiece([...piece.keys])}
                title="La partition suit alors toutes les options générales"
              >
                Tout retirer
              </button>
            )}
          </p>
        </div>
      )}
      <nav className="flex px-2 border-b border-line" role="tablist">
        {tabs.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            className={`flex-[1_1_auto] -mb-px px-1 py-2 whitespace-nowrap bg-transparent border-0 border-b-2 rounded-none ${tab === item.id ? "text-ink border-b-accent font-semibold" : "text-muted border-b-transparent hover:border-b-muted"}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="overflow-auto px-4 pt-2 pb-4" role="tabpanel">
        {tab === "editing" && (
          <>
            <Check
              id="auto-engrave"
              label="Mise en page"
              text="Mettre en page automatiquement"
              checked={options.autoEngrave}
              onChange={(autoEngrave) => setOptions({ autoEngrave })}
              hint={
                options.autoEngrave
                  ? "la mise en page suit la saisie, peu après la dernière frappe"
                  : "on met en page d'un clic sur le bouton en bas de l'éditeur (Ctrl+Entrée)"
              }
            />
            <Check
              id="score-to-text"
              label="Partition et texte"
              text="Relier la partition et le texte"
              checked={options.scoreToText}
              onChange={(scoreToText) => setOptions({ scoreToText })}
              hint={
                options.scoreToText
                  ? "un clic sur la partition place le curseur du texte sur le signe cliqué ; le signe sous le curseur du texte est encadré sur la partition"
                  : "le clic sur la partition ne place que l'écoute ; rien n'est encadré"
              }
            />
            <Choice
              id="source-colors"
              label="Coloration"
              value={options.sourceColors}
              options={SOURCE_COLORS}
              onChange={(sourceColors) => setOptions({ sourceColors })}
            />
            <Choice
              id="note-names"
              label="Noms des notes"
              value={options.noteNames}
              options={NOTE_NAMES}
              onChange={(noteNames) => setOptions({ noteNames })}
            />
          </>
        )}
        {tab === "score" && (
          <>
            <Choice
              id="chords"
              label="Accompagnement"
              value={options.chords}
              options={CHORDS}
              onChange={(chords) => setOptions({ chords })}
              scope={scope(["chords"], "chords")}
            />
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
              id="chord-chart"
              label="Grilles"
              text="Récapituler les grilles en tête de partition"
              checked={options.chordChart}
              onChange={(chordChart) => setOptions({ chordChart })}
              hint={
                options.chordChart
                  ? "la grille de guitare de chaque accord du morceau, une fois, sous le titre"
                  : "les grilles seulement sur la partition, avec l'accompagnement « Nom et grille »"
              }
              scope={scope(["chordChart"], "chordChart")}
            />
            <Check
              id="names-every-system"
              label="Parties"
              text="Répéter les noms à chaque système"
              checked={options.namesEverySystem}
              onChange={(namesEverySystem) => setOptions({ namesEverySystem })}
              hint={
                options.namesEverySystem
                  ? "le nom de chaque partie en tête de chaque système"
                  : "les noms au premier système seulement, comme sur une partition"
              }
              scope={scope(["namesEverySystem"], "namesEverySystem")}
            />
            <Choice
              id="ruler-detail"
              label="Règle"
              value={options.rulerDetail}
              options={RULER_DETAILS}
              onChange={(rulerDetail) => setOptions({ rulerDetail })}
              scope={scope(["rulerDetail"], "rulerDetail")}
            />
            <Choice
              id="sections"
              label="Sections"
              value={options.sections}
              options={SECTIONS}
              onChange={(sections) => setOptions({ sections })}
              scope={scope(["sections"], "sections")}
            />
            <Choice
              id="simile"
              label="Ped. simile"
              value={options.simile}
              options={SIMILE}
              onChange={(simile) => setOptions({ simile })}
              scope={scope(["simile"], "simile")}
            />
          </>
        )}
        {tab === "octaves" && (
          <>
            <Choice
              id="octave-position"
              label="Position"
              value={options.octavePosition}
              options={OCTAVE_POSITIONS}
              onChange={(octavePosition) => setOptions({ octavePosition })}
              scope={scope(["octavePosition"], "octavePosition")}
            />
            <Choice
              id="octave-symbol"
              label="Symbole"
              value={options.octaveStyle}
              options={OCTAVE_SYMBOLS}
              onChange={(octaveStyle) => setOptions({ octaveStyle })}
              scope={scope(["octaveStyle"], "octaveStyle")}
            />
            <Choice
              id="octave-colors"
              label="Couleurs"
              value={options.octaveColors}
              options={COLORS}
              onChange={(octaveColors) => setOptions({ octaveColors })}
              icon={(octaveColors) => <Flag colors={octaveColors} />}
              scope={scope(["octaveColors"], "octaveColors")}
            />
          </>
        )}
        {tab === "notes" && (
          <>
            <Choice
              id="density"
              label="Espacement"
              value={options.density}
              options={DENSITIES}
              onChange={(density) => setOptions({ density })}
              scope={scope(["density"], "density")}
            />
            <Choice
              id="note-position"
              label="Position"
              value={options.notePosition}
              options={NOTE_POSITIONS}
              onChange={(notePosition) => setOptions({ notePosition })}
              scope={scope(["notePosition"], "notePosition")}
            />
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
              hint={
                options.fingerings
                  ? "en chiffre blanc sur une pastille, en bas à droite de la note"
                  : "masqués : la page s'allège, le fichier les garde"
              }
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
              hint={
                options.lookAhead
                  ? "à l'écoute, dans la dernière mesure d'un système, la page glisse peu à peu pour le montrer"
                  : "à l'écoute, la page ne bouge qu'en arrivant au système suivant"
              }
            />
          </>
        )}
        {tab === "metronome" && (
          <>
            <Row label="Volume" htmlFor="click-volume" hint="par rapport aux instruments">
              <input
                type="range"
                className={SLIDER}
                id="click-volume"
                min={0}
                max={2}
                step={0.1}
                value={options.clickVolume}
                onChange={(changeEvent) => setOptions({ clickVolume: Number(changeEvent.target.value) })}
                aria-valuetext={`${Math.round(options.clickVolume * 100)} %`}
              />
              <span className="min-w-[4.5em] text-ink">{Math.round(options.clickVolume * 100)} %</span>
            </Row>
            <Check
              id="count-in"
              label="Décompte"
              text="Une mesure avant de jouer"
              checked={options.countIn}
              onChange={(countIn) => setOptions({ countIn })}
              hint="au départ et à la reprise, même métronome coupé"
            />
            <Choice
              id="click-grid"
              label="Battre"
              value={options.clickGrid}
              options={CLICK_GRIDS}
              onChange={(clickGrid) => setOptions({ clickGrid })}
            />
            {CLICK_LEVELS.map((level) => {
              const index = CLICK_SOUNDS.findIndex((sound) => sound.value === options.clickSounds[level.value]);
              return (
                <Row key={level.value} label={level.label} htmlFor={"click-" + level.value} hint={level.hint}>
                  {/* du silence au plus aigu : un curseur, plus parlant qu'une liste pour cinq crans */}
                  <input
                    type="range"
                    className={SLIDER}
                    id={"click-" + level.value}
                    min={0}
                    max={CLICK_SOUNDS.length - 1}
                    step={1}
                    value={index}
                    onChange={(changeEvent) =>
                      setOptions({
                        clickSounds: { ...options.clickSounds, [level.value]: CLICK_SOUNDS[Number(changeEvent.target.value)].value },
                      })
                    }
                    aria-valuetext={CLICK_SOUNDS[index]?.label}
                  />
                  <span className="min-w-[4.5em] text-ink">{CLICK_SOUNDS[index]?.label}</span>
                </Row>
              );
            })}
          </>
        )}
      </div>
    </aside>
  );
}
