import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_WIDTH, YmnError, importMusicXml, parseYmn, writeYmn } from "../core/index.ts";
import type { Score } from "../core/index.ts";
import { engrave } from "./engrave.ts";
import { PageView } from "./PageView.tsx";
import { SAMPLE } from "./sample.ts";
import { DENSITIES, NOTE_POSITIONS, OCTAVE_POSITIONS, OCTAVE_STYLES, loadOptions, saveOptions } from "./options.ts";
import type { RenderOptions } from "./options.ts";
import { canWriteInPlace, download, pickFile, pickSaveTarget, writeFile } from "./files.ts";

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

  const saveFile = useCallback(async () => {
    try {
      let target = handle;
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
        saveFile();
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

  const pages = useMemo(() => (engraved.score ? engrave(engraved.score, options.density === "compact") : []), [engraved, options.density]);

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

  const openFile = async () => {
    if (!canWriteInPlace) return fileInput.current?.click();
    try {
      const picked = await pickFile();
      if (picked) await open(picked.file, picked.handle);
    } catch (e) {
      setNotice(`Ouverture impossible : ${(e as Error).message}`);
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

  return (
    <div className="app">
      <header className="bar">
        <span className="brand">ymn</span>
        <button onClick={openFile}>Ouvrir…</button>
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
        <button onClick={saveFile} title="Ctrl+S">
          Enregistrer
        </button>
        <span className="file" title={handle ? "Enregistrer réécrit ce fichier" : undefined}>
          {fileName}
          {unsaved || savedText === null ? <span className="unsaved"> · non enregistré</span> : null}
        </span>
        {notice && (
          <span className="notice" role="status">
            {notice}
          </span>
        )}
        <span className="spacer" />
        <button className="primary" onClick={engraveNow} title="Ctrl+Entrée">
          Graver{dirty ? " •" : ""}
        </button>
        <button onClick={() => setShowOptions((v) => !v)} aria-expanded={showOptions} aria-controls="options">
          Options
        </button>
        <button onClick={() => window.print()} disabled={!pages.length}>
          Imprimer
        </button>
      </header>

      {showOptions && (
        <section id="options" className="options" aria-label="Options de rendu">
          <fieldset>
            <legend>Octaves</legend>
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
          </fieldset>
          <fieldset>
            <legend>Position</legend>
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
          </fieldset>
          <fieldset>
            <legend>Notes</legend>
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
            <span className="sample">dans un couloir d'octave de plusieurs lignes</span>
          </fieldset>
          <fieldset>
            <legend>Espacement</legend>
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
          </fieldset>
          <fieldset>
            <legend>Gravure</legend>
            <label>
              <input
                type="checkbox"
                id="auto-engrave"
                checked={options.autoEngrave}
                onChange={(e) => setOptions({ autoEngrave: e.target.checked })}
              />
              Graver automatiquement pendant la saisie
            </label>
          </fieldset>
        </section>
      )}

      <main className="split">
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
