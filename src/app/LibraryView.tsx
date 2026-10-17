/**
 * La bibliothèque : les morceaux du dossier choisi, rangés par sous-dossier, à chercher et à
 * trier, en liste ou en vignettes (le haut de leur première page) ; un clic ouvre le morceau.
 */
import { BackIcon, FolderIcon, RefreshIcon } from "./icons.tsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageView } from "./PageView.tsx";
import type { RenderOptions } from "./options.ts";
import { engraveOptions } from "./render.ts";
import { thumbOf } from "./thumbs.ts";
import type { Thumb } from "./thumbs.ts";
import { access, canUseLibrary, pickFolder, recentOpenings, savedFolder, scan } from "./library.ts";
import type { LibraryEntry } from "./library.ts";

type Sort = "title" | "composer" | "recent";
const SORTS: { value: Sort; label: string }[] = [
  { value: "title", label: "Titre" },
  { value: "composer", label: "Compositeur" },
  { value: "recent", label: "Ouverts récemment" },
];
const SORT_KEY = "prisma:library-sort";
const loadSort = (): Sort => {
  try {
    const s = localStorage.getItem(SORT_KEY);
    return SORTS.some((x) => x.value === s) ? (s as Sort) : "title";
  } catch {
    return "title";
  }
};

/** Les morceaux montrés : tous, les partitions .prisma seules, ou les MusicXML à importer seuls. */
type Kinds = "all" | "prisma" | "musicxml";
const KINDS_KEY = "prisma:library-kinds";
const loadKinds = (): Kinds => {
  try {
    const k = localStorage.getItem(KINDS_KEY);
    return k === "prisma" || k === "musicxml" ? k : "all";
  } catch {
    return "all";
  }
};

/** En liste, pour chercher vite ; en vignettes, pour retrouver un morceau à l'œil. */
type View = "list" | "thumbs";
const THUMBS_OWN_KEY = "prisma:thumbs-own";
const VIEW_KEY = "prisma:library-view";
const loadView = (): View => {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "thumbs";
  } catch {
    return "thumbs";
  }
};

type State =
  | { kind: "unsupported" }
  | { kind: "loading" }
  | { kind: "none" }
  | { kind: "locked"; dir: FileSystemDirectoryHandle }
  | { kind: "ready"; dir: FileSystemDirectoryHandle; entries: LibraryEntry[] }
  | { kind: "error"; message: string };

/** Pour chercher et trier sans tenir compte des accents ni des majuscules. */
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const titleOf = (e: LibraryEntry) => e.title ?? e.name.replace(/\.[^.]+$/, "");
const compare = (a: string, b: string) => a.localeCompare(b, "fr", { sensitivity: "base", numeric: true });

export function LibraryView({ options, onOpen, onClose }: { options: RenderOptions; onOpen: (entry: LibraryEntry) => void; onClose: () => void }) {
  const [view, setViewState] = useState<View>(loadView);
  const setView = (v: View) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* stockage indisponible : sans conséquence */
    }
  };
  // vignettes : chaque partition avec ses propres options, quand elle en a, ou toutes avec les générales
  const [thumbsOwn, setThumbsOwnState] = useState(() => {
    try {
      return localStorage.getItem(THUMBS_OWN_KEY) !== "false";
    } catch {
      return true;
    }
  });
  const setThumbsOwn = (v: boolean) => {
    setThumbsOwnState(v);
    try {
      localStorage.setItem(THUMBS_OWN_KEY, String(v));
    } catch {
      /* stockage indisponible : sans conséquence */
    }
  };
  const [state, setState] = useState<State>(canUseLibrary ? { kind: "loading" } : { kind: "unsupported" });
  const [query, setQuery] = useState("");
  const [sort, setSortState] = useState<Sort>(loadSort);
  const [kinds, setKindsState] = useState<Kinds>(loadKinds);
  const setKinds = (k: Kinds) => {
    setKindsState(k);
    try {
      localStorage.setItem(KINDS_KEY, k);
    } catch {
      /* stockage indisponible : sans conséquence */
    }
  };
  const setSort = (s: Sort) => {
    setSortState(s);
    try {
      localStorage.setItem(SORT_KEY, s);
    } catch {
      /* stockage indisponible : sans conséquence */
    }
  };

  const load = async (dir: FileSystemDirectoryHandle, ask = false) => {
    try {
      if (!(await access(dir, ask))) return setState({ kind: "locked", dir });
      setState({ kind: "loading" });
      setState({ kind: "ready", dir, entries: await scan(dir) });
    } catch (e) {
      setState({ kind: "error", message: (e as Error).message });
    }
  };
  useEffect(() => {
    if (!canUseLibrary) return;
    savedFolder().then((dir) => (dir ? load(dir) : setState({ kind: "none" })));
  }, []);
  const choose = async () => {
    try {
      const dir = await pickFolder();
      if (dir) await load(dir, true);
    } catch (e) {
      setState({ kind: "error", message: (e as Error).message });
    }
  };

  const groups = useMemo(() => {
    if (state.kind !== "ready") return [];
    const q = fold(query.trim());
    const found = state.entries.filter((e) => (kinds === "all" || e.kind === kinds) && (!q || fold([titleOf(e), e.composer ?? "", e.path].join(" ")).includes(q)));
    if (sort === "recent") {
      const recent = recentOpenings();
      const at = (e: LibraryEntry) => recent[e.path] ?? 0;
      return [{ folder: "", entries: [...found].sort((a, b) => at(b) - at(a) || compare(titleOf(a), titleOf(b))) }];
    }
    const key = (e: LibraryEntry) => (sort === "composer" ? [e.composer ?? "￿", titleOf(e)] : [titleOf(e), e.composer ?? ""]);
    const byFolder = new Map<string, LibraryEntry[]>();
    for (const e of found) byFolder.set(e.folder, [...(byFolder.get(e.folder) ?? []), e]);
    return [...byFolder]
      .sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : compare(a, b)))
      .map(([folder, entries]) => ({ folder, entries: entries.sort((a, b) => compare(key(a)[0], key(b)[0]) || compare(key(a)[1], key(b)[1])) }));
  }, [state, query, sort, kinds]);
  const count = groups.reduce((n, g) => n + g.entries.length, 0);
  const total = (k: Kinds) => (state.kind === "ready" ? state.entries.filter((e) => k === "all" || e.kind === k).length : 0);

  return (
    <main className="library-pane">
      <button className="back icon" onClick={onClose} title="Retour à la partition (Ctrl+B)" aria-label="Retour à la partition">
        <BackIcon />
      </button>
      <div className="library">
        <header className="library-head">
          <h1>Bibliothèque</h1>
          {(state.kind === "ready" || state.kind === "locked") && (
            <p className="library-folder">
              Dossier « {state.dir.name} »
              <button className="icon" onClick={choose} title="Changer de dossier" aria-label="Changer de dossier">
                <FolderIcon />
              </button>
              {state.kind === "ready" && (
                <button className="icon" onClick={() => load(state.dir)} title="Actualiser : relire le dossier" aria-label="Actualiser">
                  <RefreshIcon />
                </button>
              )}
            </p>
          )}
        </header>

        {state.kind === "unsupported" && (
          <p className="library-note">La bibliothèque a besoin de garder l'accès à un dossier de votre disque, ce que seuls Chrome et Edge savent faire. Ici, ouvrez vos morceaux par Fichier › Ouvrir, ou en les glissant dans la fenêtre.</p>
        )}
        {state.kind === "loading" && <p className="library-note">Lecture du dossier…</p>}
        {state.kind === "none" && (
          <div className="library-note">
            <p>Choisissez le dossier où vous rangez vos partitions (.prisma et MusicXML) : la bibliothèque les montre toutes, sous-dossiers compris. Les fichiers restent où ils sont.</p>
            <button className="library-action" onClick={choose}>
              Choisir un dossier
            </button>
          </div>
        )}
        {state.kind === "locked" && (
          <div className="library-note">
            <p>Le navigateur demande de confirmer l'accès au dossier « {state.dir.name} ».</p>
            <button className="library-action" onClick={() => load(state.dir, true)}>
              Autoriser l'accès
            </button>
          </div>
        )}
        {state.kind === "error" && (
          <div className="library-note">
            <p>Lecture du dossier impossible : {state.message}</p>
            <button className="library-action" onClick={choose}>
              Choisir un dossier
            </button>
          </div>
        )}

        {state.kind === "ready" && (
          <>
            <div className="library-tools">
              <input type="search" placeholder="Chercher un titre, un compositeur…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Chercher" autoFocus />
              <label>
                Afficher
                <select value={kinds} onChange={(e) => setKinds(e.target.value as Kinds)}>
                  <option value="all">Tout ({total("all")})</option>
                  <option value="prisma">Partitions Prisma ({total("prisma")})</option>
                  <option value="musicxml">MusicXML à importer ({total("musicxml")})</option>
                </select>
              </label>
              <label>
                Trier par
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              {view === "thumbs" && (
                <label className="check" title="Les vignettes montrent chaque partition avec ses propres options, si elle en a ; sinon avec les options générales">
                  <input type="checkbox" checked={thumbsOwn} onChange={(e) => setThumbsOwn(e.target.checked)} />
                  Options de chaque partition
                </label>
              )}
              <span className="library-view" role="group" aria-label="Présentation">
                <button className={view === "list" ? "on" : undefined} aria-pressed={view === "list"} onClick={() => setView("list")} title="En liste" aria-label="En liste">
                  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
                    <path fill="currentColor" d="M1.5 3h2v2h-2zM5.5 3.25h9v1.5h-9zM1.5 7h2v2h-2zM5.5 7.25h9v1.5h-9zM1.5 11h2v2h-2zM5.5 11.25h9v1.5h-9z" />
                  </svg>
                </button>
                <button className={view === "thumbs" ? "on" : undefined} aria-pressed={view === "thumbs"} onClick={() => setView("thumbs")} title="En vignettes : le haut de la première page" aria-label="En vignettes">
                  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
                    <path fill="currentColor" d="M1.5 1.5h5.5v5.5h-5.5zM9 1.5h5.5v5.5H9zM1.5 9h5.5v5.5h-5.5zM9 9h5.5v5.5H9z" />
                  </svg>
                </button>
              </span>
            </div>
            {!state.entries.length && <p className="library-note">Aucune partition (.prisma ou MusicXML) dans ce dossier.</p>}
            {state.entries.length > 0 && !count && (
              <p className="library-note">{query.trim() ? `Aucun morceau ne correspond à « ${query.trim()} ».` : kinds === "prisma" ? "Aucune partition Prisma dans ce dossier." : "Aucun MusicXML à importer dans ce dossier."}</p>
            )}
            {groups.map((g) => (
              <section key={g.folder} className="library-group">
                {g.folder && <h2>{g.folder}</h2>}
                {view === "thumbs" ? (
                  <ul className="library-cards">
                    {g.entries.map((e) => (
                      <li key={e.path}>
                        <button onClick={() => onOpen(e)} title={e.path}>
                          <ThumbView entry={e} options={thumbsOwn && e.own ? { ...options, ...e.own } : options} />
                          <span className="library-title">{titleOf(e)}</span>
                          <span className="library-composer">{e.composer ?? "\u00a0"}</span>
                          <span className="library-meta">
                            {sort === "recent" && e.folder ? `${e.folder}/` : ""}
                            {e.name}
                            {e.kind === "musicxml" && <span className="library-badge">à importer</span>}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                <ul>
                  {g.entries.map((e) => (
                    <li key={e.path}>
                      <button onClick={() => onOpen(e)} title={e.path}>
                        <span className="library-title">{titleOf(e)}</span>
                        {e.composer && <span className="library-composer">{e.composer}</span>}
                        <span className="library-meta">
                          {sort === "recent" && e.folder ? `${e.folder}/` : ""}
                          {e.name}
                          {e.kind === "musicxml" && <span className="library-badge">à importer</span>}
                          <span className="library-date">{new Date(e.modified).toLocaleDateString("fr-FR")}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                )}
              </section>
            ))}
          </>
        )}
      </div>
    </main>
  );
}

/**
 * Vignette d'un morceau : le haut de sa première page (titre, premiers systèmes), calculé quand
 * la vignette paraît à l'écran.
 */
function ThumbView({ entry, options }: { entry: LibraryEntry; options: RenderOptions }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [result, setResult] = useState<{ thumb?: Thumb; error?: string }>();
  const engraving = JSON.stringify(engraveOptions(options));
  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const seen = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { root: el.closest(".library-pane"), rootMargin: "300px" });
    seen.observe(el);
    return () => seen.disconnect();
  }, [visible]);
  useEffect(() => {
    if (!visible) return;
    let live = true;
    setResult(undefined);
    thumbOf(entry, JSON.parse(engraving)).then((r) => live && setResult(r));
    return () => {
      live = false;
    };
  }, [visible, entry, engraving]);
  return (
    <span className="thumb" ref={ref} aria-hidden>
      {result?.thumb && <PageView page={result.thumb.page} total={result.thumb.total} meta={result.thumb.meta} options={options} still />}
      {result?.error && <span className="thumb-note">Aperçu impossible : le fichier ne se lit pas</span>}
      {result && !result.thumb && !result.error && <span className="thumb-note">Aucune mesure</span>}
    </span>
  );
}
