import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_WIDTH, YmnError, importMusicXml, parseYmn, writeYmn } from "../core/index.ts";
import type { Score } from "../core/index.ts";
import { engrave } from "./engrave.ts";
import { PageView } from "./PageView.tsx";
import { SAMPLE } from "./sample.ts";

const STORAGE_KEY = "ymn:source";
const load = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? SAMPLE;
  } catch {
    return SAMPLE;
  }
};
const save = (s: string) => {
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
  const [engraved, setEngraved] = useState(() => tryParse(source));
  const [fileName, setFileName] = useState("morceau.ymn");
  const [dirty, setDirty] = useState(false);
  const editor = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const engraveNow = useCallback(() => {
    setEngraved(tryParse(source));
    setDirty(false);
    save(source);
  }, [source]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        engraveNow();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engraveNow]);

  const pages = useMemo(() => (engraved.score ? engrave(engraved.score) : []), [engraved]);

  const open = async (file: File) => {
    const text = await file.text();
    let ymn = text;
    if (/\.(musicxml|xml)$/i.test(file.name)) {
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
    setDirty(false);
    save(ymn);
  };

  const download = () => {
    const blob = new Blob([source], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
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
        <button onClick={() => fileInput.current?.click()}>Ouvrir…</button>
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
        <button onClick={download}>Enregistrer</button>
        <span className="spacer" />
        <button className="primary" onClick={engraveNow} title="Ctrl+Entrée">
          Graver{dirty ? " •" : ""}
        </button>
        <button onClick={() => window.print()} disabled={!pages.length}>
          Imprimer
        </button>
      </header>

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
              setDirty(true);
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
            <PageView key={p.index} page={p} total={pages.length} meta={score!.meta} />
          ))}
        </section>
      </main>
    </div>
  );
}
