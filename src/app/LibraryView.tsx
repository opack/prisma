/**
 * La bibliothèque : les morceaux du dossier choisi, rangés par sous-dossier, à chercher et à
 * trier ; un clic ouvre le morceau.
 */
import { useEffect, useMemo, useState } from "react";
import { access, canUseLibrary, pickFolder, recentOpenings, savedFolder, scan } from "./library.ts";
import type { LibraryEntry } from "./library.ts";

type Sort = "title" | "composer" | "recent";
const SORTS: { value: Sort; label: string }[] = [
  { value: "title", label: "Titre" },
  { value: "composer", label: "Compositeur" },
  { value: "recent", label: "Ouverts récemment" },
];
const SORT_KEY = "ymn:library-sort";
const loadSort = (): Sort => {
  try {
    const s = localStorage.getItem(SORT_KEY);
    return SORTS.some((x) => x.value === s) ? (s as Sort) : "title";
  } catch {
    return "title";
  }
};

/** Les morceaux montrés : tous, les partitions .ymn seules, ou les MusicXML à importer seuls. */
type Kinds = "all" | "ymn" | "musicxml";
const KINDS_KEY = "ymn:library-kinds";
const loadKinds = (): Kinds => {
  try {
    const k = localStorage.getItem(KINDS_KEY);
    return k === "ymn" || k === "musicxml" ? k : "all";
  } catch {
    return "all";
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

export function LibraryView({ onOpen, onClose }: { onOpen: (entry: LibraryEntry) => void; onClose: () => void }) {
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
      <button className="back" onClick={onClose}>
        ← Retour à la partition
      </button>
      <div className="library">
        <header className="library-head">
          <h1>Bibliothèque</h1>
          {(state.kind === "ready" || state.kind === "locked") && (
            <p className="library-folder">
              Dossier « {state.dir.name} »
              <button onClick={choose}>Changer de dossier</button>
              {state.kind === "ready" && <button onClick={() => load(state.dir)}>Actualiser</button>}
            </p>
          )}
        </header>

        {state.kind === "unsupported" && (
          <p className="library-note">La bibliothèque a besoin de garder l'accès à un dossier de votre disque, ce que seuls Chrome et Edge savent faire. Ici, ouvrez vos morceaux par Fichier › Ouvrir, ou en les glissant dans la fenêtre.</p>
        )}
        {state.kind === "loading" && <p className="library-note">Lecture du dossier…</p>}
        {state.kind === "none" && (
          <div className="library-note">
            <p>Choisissez le dossier où vous rangez vos partitions (.ymn et MusicXML) : la bibliothèque les montre toutes, sous-dossiers compris. Les fichiers restent où ils sont.</p>
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
                  <option value="ymn">Partitions ymn ({total("ymn")})</option>
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
            </div>
            {!state.entries.length && <p className="library-note">Aucune partition (.ymn ou MusicXML) dans ce dossier.</p>}
            {state.entries.length > 0 && !count && (
              <p className="library-note">{query.trim() ? `Aucun morceau ne correspond à « ${query.trim()} ».` : kinds === "ymn" ? "Aucune partition ymn dans ce dossier." : "Aucun MusicXML à importer dans ce dossier."}</p>
            )}
            {groups.map((g) => (
              <section key={g.folder} className="library-group">
                {g.folder && <h2>{g.folder}</h2>}
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
              </section>
            ))}
          </>
        )}
      </div>
    </main>
  );
}
