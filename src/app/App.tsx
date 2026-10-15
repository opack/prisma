import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_WIDTH, YmnError, importMusicXml, parseYmn, writeYmn } from "../core/index.ts";
import type { Score } from "../core/index.ts";
import { engrave } from "./engrave.ts";
import { Menu } from "./Menu.tsx";
import { ListenControls } from "./ListenControls.tsx";
import { withSimile } from "./pedal.ts";
import { CLICK_SOUNDS } from "./metronome.ts";
import type { ClickGrid, ClickLevel } from "./performance.ts";

/** Ce que fait entendre chaque façon de battre le métronome. */
const GRID_HINTS: Record<ClickGrid, string> = {
  cells: "un coup par case écrite : il fait entendre quand jouer",
  attacks: "seulement là où une note commence : ni les tenues, ni les silences",
  beats: "une grille régulière, quelles que soient les cases écrites",
};

/** Les niveaux du métronome, chacun avec son son au choix. */
const CLICK_LEVELS: { value: ClickLevel; label: string; sample: string }[] = [
  { value: "downbeat", label: "Premier temps", sample: "de la mesure (1)" },
  { value: "beat", label: "Temps", sample: "1, 2, 3…" },
  { value: "division", label: "Division", sample: "le temps en 2 (ou en 3) : *" },
  { value: "subdivision", label: "Subdivision", sample: "chaque division en 2 : ." },
];
import { player } from "./player.ts";
import { NoticeView } from "./NoticeView.tsx";
import { PageView } from "./PageView.tsx";
import { SAMPLE } from "./sample.ts";
import { CHORD_STYLES, CLICK_GRIDS, DENSITIES, NOTE_POSITIONS, OCTAVE_PALETTES, OCTAVE_POSITIONS, OCTAVE_STYLES, SIMILE_DISPLAYS, loadOptions, saveOptions } from "./options.ts";
import type { RenderOptions } from "./options.ts";
import { OPENABLE, canWriteInPlace, download, droppedFile, pickFile, pickSaveTarget, writeFile } from "./files.ts";

/** Délai sans frappe avant la gravure automatique. */
const AUTO_ENGRAVE_DELAY = 600;

const STORAGE_KEY = "ymn:source";
const load = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? SAMPLE;
  } catch {
    return SAMPLE;
  }
};
const persist = (s: string) => {
  try {
    localStorage.setItem(STORAGE_KEY, s);
  } catch {
    /* stockage indisponible : sans conséquence */
  }
};

type Problem = { message: string; line?: number; column?: number };

function tryParse(text: string): { score?: Score; problem?: Problem } {
  // texte vide (nouvelle partition) : rien à graver, ce n'est pas une erreur
  if (!text.trim()) return {};
  try {
    return { score: parseYmn(text) };
  } catch (e) {
    if (e instanceof YmnError) return { problem: { message: e.message, line: e.line, column: e.column } };
    return { problem: { message: (e as Error).message } };
  }
}

export function App() {
  const [source, setSource] = useState(load);
  const [options, setOptionsState] = useState<RenderOptions>(loadOptions);
  const [showOptions, setShowOptions] = useState(false);
  // Échap ferme le panneau d'options
  useEffect(() => {
    if (!showOptions) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShowOptions(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showOptions]);
  /** Notice du pianiste, affichée à la place de l'éditeur et de l'aperçu. */
  const [showGuide, setShowGuide] = useState(false);
  const setOptions = (patch: Partial<RenderOptions>) => {
    const next = { ...options, ...patch };
    setOptionsState(next);
    saveOptions(next);
  };
  const [engraved, setEngraved] = useState(() => tryParse(source));
  const [fileName, setFileName] = useState("morceau.ymn");
  /** Fichier .ymn ouvert ou enregistré, réécrit en place par « Enregistrer » (Chrome, Edge). */
  const [handle, setHandle] = useState<FileSystemFileHandle | null>(null);
  /** Texte tel qu'il est sur le disque, pour savoir s'il reste des modifications à enregistrer. */
  const [savedText, setSavedText] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Dernier texte gravé : la pastille « • » ne s'affiche que si le texte actuel en diffère. */
  const [engravedSource, setEngravedSource] = useState(source);
  const dirty = source !== engravedSource;
  const unsaved = savedText !== null && source !== savedText;
  const editor = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const engraveNow = useCallback(() => {
    setEngraved(tryParse(source));
    setEngravedSource(source);
    persist(source);
  }, [source]);

  /** Enregistre ; « sous » : toujours dans un nouveau fichier, choisi par l'utilisateur. */
  const saveFile = useCallback(async (as = false) => {
    try {
      let target = as ? null : handle;
      if (!target && canWriteInPlace) {
        target = await pickSaveTarget(fileName);
        if (!target) return; // annulé
        setHandle(target);
        setFileName(target.name);
      }
      if (target) {
        await writeFile(target, source);
        setSavedText(source);
        setNotice(`Enregistré dans ${target.name}`);
      } else {
        download(fileName, source);
        setSavedText(source);
        setNotice(`Téléchargé sous le nom ${fileName}`);
      }
    } catch (e) {
      setNotice(`Enregistrement impossible : ${(e as Error).message}`);
    }
  }, [handle, fileName, source]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        engraveNow();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveFile(e.shiftKey);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") {
        e.preventDefault();
        openFileRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engraveNow, saveFile]);

  // gravure automatique, après un court délai sans frappe
  useEffect(() => {
    if (!options.autoEngrave || !dirty) return;
    const t = setTimeout(engraveNow, AUTO_ENGRAVE_DELAY);
    return () => clearTimeout(t);
  }, [options.autoEngrave, dirty, engraveNow]);

  // prévenir avant de quitter avec des modifications non enregistrées
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const pages = useMemo(() => {
    if (!engraved.score) return [];
    // doigtés masqués : retirés avant la gravure, pour que les cases reprennent leur largeur
    const plain = options.fingerings ? engraved.score : { ...engraved.score, notes: engraved.score.notes.map(({ finger: _, ...n }) => n) };
    // « Ped. simile » : les pédales qu'il demande, gravées comme les autres ou atténuées, ou la mention seule
    const score = withSimile(plain, options.simile);
    return engrave(score, { compact: options.density === "compact", chords: options.chords, align: options.notePosition === "aligned", reminders: options.holdReminders });
  }, [engraved, options.density, options.fingerings, options.chords, options.notePosition, options.holdReminders, options.simile]);

  const open = async (file: File, fileHandle: FileSystemFileHandle | null = null) => {
    const text = await file.text();
    let ymn = text;
    const isXml = /\.(musicxml|xml)$/i.test(file.name);
    // un MusicXML n'est jamais réécrit : le premier enregistrement crée un nouveau .ymn
    setHandle(isXml ? null : fileHandle);
    setSavedText(isXml ? null : text);
    if (isXml) {
      try {
        ymn = writeYmn(importMusicXml(text, file.name), { width: DEFAULT_WIDTH });
      } catch (e) {
        setEngraved({ problem: { message: `Import MusicXML impossible : ${(e as Error).message}` } });
        return;
      }
      setFileName(file.name.replace(/\.(musicxml|xml)$/i, ".ymn"));
    } else {
      setFileName(file.name);
    }
    setSource(ymn);
    setEngraved(tryParse(ymn));
    setEngravedSource(ymn);
    persist(ymn);
  };

  /** Modifications perdues si l'on remplace le texte : on demande d'abord. */
  // rien à perdre : le fichier tel qu'enregistré, ou, sans fichier, un texte vide ou l'exemple de départ
  const pristine = savedText === null ? !source.trim() || source === SAMPLE : source === savedText;
  const confirmDiscard = (question: string) => pristine || window.confirm(question);

  const openFile = async () => {
    if (!confirmDiscard("Ouvrir un autre fichier ? Les modifications non enregistrées seront perdues.")) return;
    if (!canWriteInPlace) return fileInput.current?.click();
    try {
      const picked = await pickFile();
      if (picked) await open(picked.file, picked.handle);
    } catch (e) {
      setNotice(`Ouverture impossible : ${(e as Error).message}`);
    }
  };
  const openFileRef = useRef(openFile);
  openFileRef.current = openFile;

  // glisser-déposer un fichier sur la fenêtre pour l'ouvrir ; le compteur suit les entrées et
  // sorties successives au-dessus des éléments de la page
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const hasFile = (e: React.DragEvent) => [...e.dataTransfer.types].includes("Files");
  const onDragEnter = (e: React.DragEvent) => {
    if (!hasFile(e)) return;
    e.preventDefault();
    dragDepth.current++;
    setDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    if (!hasFile(e)) return;
    if (--dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragging(false);
    }
  };
  const onDragOver = (e: React.DragEvent) => {
    if (!hasFile(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const onDrop = async (e: React.DragEvent) => {
    if (!hasFile(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const dropped = await droppedFile(e.dataTransfer);
    if (!dropped) return;
    if (!OPENABLE.test(dropped.file.name)) {
      setNotice(`« ${dropped.file.name} » : format non pris en charge (.ymn ou .musicxml non compressé)`);
      return;
    }
    if (!confirmDiscard(`Ouvrir ${dropped.file.name} ? Les modifications non enregistrées seront perdues.`)) return;
    try {
      await open(dropped.file, dropped.handle);
      setShowGuide(false);
    } catch (err) {
      setNotice(`Ouverture impossible : ${(err as Error).message}`);
    }
  };

  /** Nouvelle partition : tout est effacé. */
  const newFile = () => {
    if (!confirmDiscard("Effacer la partition en cours ? Les modifications non enregistrées seront perdues.")) return;
    setSource("");
    setEngraved({});
    setEngravedSource("");
    setHandle(null);
    setSavedText(null);
    setFileName("morceau.ymn");
    persist("");
    editor.current?.focus();
  };

  /** Relit depuis le disque le fichier ouvert (modifié ailleurs, ou pour annuler ses changements). */
  const reloadFile = async () => {
    if (!handle) return;
    if (unsaved && !window.confirm(`Recharger ${handle.name} depuis le disque ? Les modifications non enregistrées seront perdues.`)) return;
    try {
      await open(await handle.getFile(), handle);
      setNotice(`${handle.name} rechargé`);
    } catch (e) {
      setNotice(`Rechargement impossible : ${(e as Error).message}`);
    }
  };

  /** Place le curseur sur la ligne et la colonne d'une erreur. */
  const goTo = (line?: number, column = 1) => {
    const ta = editor.current;
    if (!ta || !line) return;
    const lines = source.split("\n");
    let pos = 0;
    for (let i = 0; i < line - 1 && i < lines.length; i++) pos += lines[i].length + 1;
    pos += Math.max(0, column - 1);
    ta.focus();
    ta.setSelectionRange(pos, pos + 1);
    const lineH = parseFloat(getComputedStyle(ta).lineHeight) || 18;
    ta.scrollTop = Math.max(0, (line - 4) * lineH);
  };

  const { problem, score } = engraved;
  // écoute : le morceau gravé, avec le curseur sur la gravure ; arrêtée quand on regrave
  useEffect(() => player.load(score), [score]);
  useEffect(
    () =>
      player.setSound({
        metronome: options.metronome,
        instruments: options.instruments,
        clickSounds: options.clickSounds,
        clickGrid: options.clickGrid,
        countIn: options.countIn,
        clickVolume: options.clickVolume,
      }),
    [options.metronome, options.instruments, options.clickSounds, options.clickGrid, options.countIn, options.clickVolume],
  );

  return (
    <div className="app" onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDragOver={onDragOver} onDrop={onDrop}>
      {dragging && (
        <div className="drop" aria-hidden>
          <p>Déposer pour ouvrir</p>
          <span>.ymn ou .musicxml</span>
        </div>
      )}
      <header className="bar">
        <span className="brand">ymn</span>
        <Menu
          label="Fichier"
          items={[
            { label: "Nouveau", onSelect: newFile },
            { label: "Ouvrir…", onSelect: openFile, shortcut: "Ctrl+O" },
            "separator",
            { label: "Enregistrer", onSelect: () => saveFile(), shortcut: "Ctrl+S" },
            { label: "Enregistrer sous…", onSelect: () => saveFile(true), shortcut: "Ctrl+Maj+S" },
            "separator",
            { label: "Recharger", onSelect: reloadFile, disabled: !handle },
          ]}
        />
        <Menu
          label="Gravure"
          items={[
            { label: "Graver", onSelect: engraveNow, shortcut: "Ctrl+Entrée" },
            { label: "Options", onSelect: () => setShowOptions((v) => !v), checked: showOptions },
            "separator",
            { label: "Imprimer…", onSelect: () => window.print(), shortcut: "Ctrl+P", disabled: !pages.length || showGuide },
          ]}
        />
        <Menu label="Aide" items={[{ label: "Notice", onSelect: () => setShowGuide((v) => !v), checked: showGuide }]} />
        <input
          ref={fileInput}
          type="file"
          accept=".ymn,.txt,.musicxml,.xml"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) open(f);
            e.target.value = "";
          }}
        />
        <span className="file" title={handle ? "Enregistrer réécrit ce fichier" : undefined}>
          {fileName}
          {unsaved || savedText === null ? <span className="unsaved"> · non enregistré</span> : null}
        </span>
        {notice && (
          <span className="notice" role="status">
            {notice}
          </span>
        )}
        <ListenControls
          score={score}
          disabled={!score || !pages.length}
          metronome={options.metronome}
          instruments={options.instruments}
          onSound={(sound) => setOptions(sound)}
        />
        <button className="primary" onClick={engraveNow} title="Ctrl+Entrée">
          Graver{dirty ? " •" : ""}
        </button>
      </header>

      {showOptions && (
        <section id="options" className="options" aria-label="Options de rendu">
          <button className="close" onClick={() => setShowOptions(false)} aria-label="Fermer les options" title="Fermer (Échap)">
            ×
          </button>
          <div className="group">
            <h2>Général</h2>
            <fieldset>
              <legend>Accompagnement</legend>
              <div className="choices">
                {CHORD_STYLES.map((c) => (
                  <label key={c.value}>
                    <input
                      type="radio"
                      name="chords"
                      id={"chords-" + c.value}
                      checked={options.chords === c.value}
                      onChange={() => setOptions({ chords: c.value })}
                    />
                    {c.label} <span className="sample">{c.sample}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Gravure</legend>
              <div className="choices">
                <label>
                  <input
                    type="checkbox"
                    id="auto-engrave"
                    checked={options.autoEngrave}
                    onChange={(e) => setOptions({ autoEngrave: e.target.checked })}
                  />
                  Graver automatiquement pendant la saisie
                </label>
              </div>
            </fieldset>
            <fieldset>
              <legend>Instruments</legend>
              <div className="choices">
                <label>
                  <input
                    type="checkbox"
                    id="names-every-system"
                    checked={options.namesEverySystem}
                    onChange={(e) => setOptions({ namesEverySystem: e.target.checked })}
                  />
                  Répéter les noms à chaque système
                </label>
                <span className="sample">sinon, au premier système seulement</span>
              </div>
            </fieldset>
            <fieldset>
              <legend>Ped. simile</legend>
              <div className="choices">
                {SIMILE_DISPLAYS.map((d) => (
                  <label key={d.value}>
                    <input
                      type="radio"
                      name="simile"
                      id={"simile-" + d.value}
                      checked={options.simile === d.value}
                      onChange={() => setOptions({ simile: d.value })}
                    />
                    {d.label}
                  </label>
                ))}
                <span className="sample">les pédales que demande « Ped. simile » ; le fichier garde la mention</span>
              </div>
            </fieldset>
          </div>
          <div className="group">
            <h2>Métronome</h2>
            <fieldset>
              <legend>Battre</legend>
              <div className="choices">
                {CLICK_GRIDS.map((g) => (
                  <label key={g.value}>
                    <input type="radio" name="clickGrid" id={"click-grid-" + g.value} checked={options.clickGrid === g.value} onChange={() => setOptions({ clickGrid: g.value })} />
                    {g.label}
                  </label>
                ))}
                <span className="sample">{GRID_HINTS[options.clickGrid]}</span>
              </div>
            </fieldset>
            <fieldset>
              <legend>Volume</legend>
              <div className="choices">
                <input
                  type="range"
                  className="click-sound"
                  id="click-volume"
                  min={0}
                  max={2}
                  step={0.1}
                  value={options.clickVolume}
                  onChange={(e) => setOptions({ clickVolume: Number(e.target.value) })}
                  aria-valuetext={`${Math.round(options.clickVolume * 100)} %`}
                />
                <span className="click-sound-name">{Math.round(options.clickVolume * 100)} %</span>
                <span className="sample">par rapport aux instruments</span>
              </div>
            </fieldset>
            <fieldset>
              <legend>Décompte</legend>
              <div className="choices">
                <label>
                  <input type="checkbox" id="count-in" checked={options.countIn} onChange={(e) => setOptions({ countIn: e.target.checked })} />
                  Une mesure avant de jouer
                </label>
                <span className="sample">au départ et à la reprise, même métronome coupé</span>
              </div>
            </fieldset>
            {CLICK_LEVELS.map((l) => (
              <fieldset key={l.value}>
                <legend>{l.label}</legend>
                <div className="choices">
                  {/* du silence au plus aigu : un curseur, plus parlant qu'une liste pour cinq crans */}
                  <input
                    type="range"
                    className="click-sound"
                    id={"click-" + l.value}
                    min={0}
                    max={CLICK_SOUNDS.length - 1}
                    step={1}
                    value={CLICK_SOUNDS.findIndex((c) => c.value === options.clickSounds[l.value])}
                    onChange={(e) => setOptions({ clickSounds: { ...options.clickSounds, [l.value]: CLICK_SOUNDS[Number(e.target.value)].value } })}
                    aria-valuetext={CLICK_SOUNDS.find((c) => c.value === options.clickSounds[l.value])?.label}
                  />
                  <span className="click-sound-name">{CLICK_SOUNDS.find((c) => c.value === options.clickSounds[l.value])?.label}</span>
                  <span className="sample">{l.sample}</span>
                </div>
              </fieldset>
            ))}
          </div>
          <div className="group">
            <h2>Octaves</h2>
            <fieldset>
              <legend>Symbole</legend>
              <div className="choices">
                {OCTAVE_STYLES.map((s) => (
                  <label key={s.value}>
                    <input
                      type="radio"
                      name="octaveStyle"
                      id={"octave-" + s.value}
                      checked={options.octaveStyle === s.value}
                      onChange={() => setOptions({ octaveStyle: s.value })}
                    />
                    {s.label} <span className="sample">{s.sample}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Position</legend>
              <div className="choices">
                {OCTAVE_POSITIONS.map((p) => (
                  <label key={p.value}>
                    <input
                      type="radio"
                      name="octavePosition"
                      id={"position-" + p.value}
                      checked={options.octavePosition === p.value}
                      onChange={() => setOptions({ octavePosition: p.value })}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Couleurs</legend>
              <div className="choices">
                {OCTAVE_PALETTES.map((p) => (
                  <label key={p.value}>
                    <input
                      type="radio"
                      name="octavePalette"
                      id={"palette-" + p.value}
                      checked={options.octavePalette === p.value}
                      onChange={() => setOptions({ octavePalette: p.value })}
                    />
                    {p.label}
                  </label>
                ))}
                <label>
                  <input
                    type="checkbox"
                    id="octave-mixed"
                    checked={options.octaveMixed}
                    disabled={options.octavePalette === "none"}
                    onChange={(e) => setOptions({ octaveMixed: e.target.checked })}
                  />
                  Ordre mélangé
                </label>
                <span className="sample">une couleur fixe par octave ; mélangées, deux octaves voisines contrastent davantage</span>
              </div>
            </fieldset>
          </div>
          <div className="group">
            <h2>Notes</h2>
            <fieldset>
              <legend>Position</legend>
              <div className="choices">
                {NOTE_POSITIONS.map((p) => (
                  <label key={p.value}>
                    <input
                      type="radio"
                      name="notePosition"
                      id={"notes-" + p.value}
                      checked={options.notePosition === p.value}
                      onChange={() => setOptions({ notePosition: p.value })}
                    />
                    {p.label}
                  </label>
                ))}
                <span className="sample">dans un couloir d'octave de plusieurs lignes ; alignées : une note rejouée garde sa ligne</span>
              </div>
            </fieldset>
            <fieldset>
              <legend>Espacement</legend>
              <div className="choices">
                {DENSITIES.map((d) => (
                  <label key={d.value}>
                    <input
                      type="radio"
                      name="density"
                      id={"density-" + d.value}
                      checked={options.density === d.value}
                      onChange={() => setOptions({ density: d.value })}
                    />
                    {d.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Doigtés</legend>
              <div className="choices">
                <label>
                  <input
                    type="checkbox"
                    id="fingerings"
                    checked={options.fingerings}
                    onChange={(e) => setOptions({ fingerings: e.target.checked })}
                  />
                  Afficher les doigtés
                </label>
              </div>
            </fieldset>
            <fieldset>
              <legend>Tenues</legend>
              <div className="choices">
                <label>
                  <input
                    type="checkbox"
                    id="hold-reminders"
                    checked={options.holdReminders}
                    onChange={(e) => setOptions({ holdReminders: e.target.checked })}
                  />
                  Rappeler la note tenue en début de ligne
                </label>
                <span className="sample">— 8 ; sinon le seul trait de tenue</span>
              </div>
            </fieldset>
          </div>
        </section>
      )}

      {showGuide && (
        <main className="guide-pane">
          <button className="back" onClick={() => setShowGuide(false)}>
            ← Retour à la partition
          </button>
          <NoticeView options={options} />
        </main>
      )}
      <main className="split" hidden={showGuide}>
        <section className="source">
          <textarea
            ref={editor}
            value={source}
            spellCheck={false}
            wrap="off"
            aria-label="Source .ymn"
            onChange={(e) => {
              setSource(e.target.value);
            }}
          />
          {problem && (
            <button className="problem" onClick={() => goTo(problem.line, problem.column)}>
              {problem.message}
            </button>
          )}
        </section>

        <section className="preview" aria-label="Aperçu">
          {score && !pages.length && <p className="empty">Aucune mesure à graver.</p>}
          {pages.map((p) => (
            <PageView key={p.index} page={p} total={pages.length} meta={score!.meta} options={options} />
          ))}
        </section>
      </main>
    </div>
  );
}
