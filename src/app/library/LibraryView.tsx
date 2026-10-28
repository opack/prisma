/**
 * La bibliothèque : les morceaux du dossier choisi, rangés par sous-dossier, à chercher et à
 * trier, en liste ou en vignettes (le haut de leur première page) ; un clic ouvre le morceau.
 */
import { FolderIcon, RefreshIcon } from "../ui/icons.tsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageView } from "../score/PageView.tsx";
import type { RenderOptions } from "../options/options.ts";
import { engraveOptions } from "../score/render.ts";
import { thumbOf } from "./thumbs.ts";
import type { Thumb } from "./thumbs.ts";
import { canUseDisk, pickFolder, savedFolder } from "./diskLibrary.ts";
import { recentOpenings, scan } from "./library.ts";
import { BackButton } from "../ui/button/BackButton.tsx";
import { Button } from "../ui/button/Button.tsx";
import { ButtonGroup } from "../ui/button/ButtonGroup.tsx";

/** Une explication de la bibliothèque (le dossier à choisir, à autoriser…). */
const NOTE = "text-muted leading-[1.5]";
/** Afficher, Trier par : leur nom, puis leur liste. */
const TOOL = "flex items-center gap-2 text-muted whitespace-nowrap";
const SELECT = "px-1.5 py-[5px] bg-white border border-line rounded";
/** Un morceau, en ligne ou en vignette : tout le bouton se clique. */
const ENTRY = "w-full text-left bg-transparent border-0 hover:bg-panel";
/** Le fichier du morceau, son type, sa date. */
const META = "col-span-full flex items-center gap-2.5 text-muted";
import type { LibraryEntry, LibrarySource } from "./library.ts";

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
  | { kind: "locked"; source: LibrarySource }
  | { kind: "ready"; source: LibrarySource; entries: LibraryEntry[] }
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
  const [state, setState] = useState<State>(canUseDisk ? { kind: "loading" } : { kind: "unsupported" });
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

  const load = async (source: LibrarySource, ask = false) => {
    try {
      if (!(await source.access(ask))) return setState({ kind: "locked", source });
      setState({ kind: "loading" });
      setState({ kind: "ready", source, entries: await scan(source) });
    } catch (e) {
      setState({ kind: "error", message: (e as Error).message });
    }
  };
  useEffect(() => {
    if (!canUseDisk) return;
    savedFolder().then((source) => (source ? load(source) : setState({ kind: "none" })));
  }, []);
  const choose = async () => {
    try {
      const source = await pickFolder();
      if (source) await load(source, true);
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
    <main data-library className="flex-1 overflow-auto bg-white">
      <BackButton onClick={onClose} shortcut="Ctrl+B" />
      <div className="max-w-[860px] mx-auto px-8 pt-2 pb-16">
        <header>
          <h1 className="mx-0 mt-2 mb-1 text-[26px]">Bibliothèque</h1>
          {(state.kind === "ready" || state.kind === "locked") && (
            <p className="flex flex-wrap items-center gap-2 mt-0 mb-4 text-muted">
              {state.source.label}
              <Button size="icon" onClick={choose} title="Changer de dossier" aria-label="Changer de dossier">
                <FolderIcon />
              </Button>
              {state.kind === "ready" && (
                <Button size="icon" onClick={() => load(state.source)} title="Actualiser : relire le dossier" aria-label="Actualiser">
                  <RefreshIcon />
                </Button>
              )}
            </p>
          )}
        </header>

        {state.kind === "unsupported" && (
          <p className={NOTE}>La bibliothèque a besoin de garder l'accès à un dossier de votre disque, ce que seuls Chrome et Edge savent faire. Ici, ouvrez vos morceaux par Fichier › Ouvrir, ou en les glissant dans la fenêtre.</p>
        )}
        {state.kind === "loading" && <p className={NOTE}>Lecture du dossier…</p>}
        {state.kind === "none" && (
          <div className={NOTE}>
            <p className="mt-0 mb-3">Choisissez le dossier où vous rangez vos partitions (.prisma et MusicXML) : la bibliothèque les montre toutes, sous-dossiers compris. Les fichiers restent où ils sont.</p>
            <Button kind="primary" onClick={choose}>
              Choisir un dossier
            </Button>
          </div>
        )}
        {state.kind === "locked" && (
          <div className={NOTE}>
            <p className="mt-0 mb-3">Le navigateur demande de confirmer l'accès au {state.source.label.replace(/^./, (c) => c.toLowerCase())}.</p>
            <Button kind="primary" onClick={() => load(state.source, true)}>
              Autoriser l'accès
            </Button>
          </div>
        )}
        {state.kind === "error" && (
          <div className={NOTE}>
            <p className="mt-0 mb-3">Lecture du dossier impossible : {state.message}</p>
            <Button kind="primary" onClick={choose}>
              Choisir un dossier
            </Button>
          </div>
        )}

        {state.kind === "ready" && (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 mt-0 mb-5">
              <input className="flex-[1_1_100%] min-w-0 px-2.5 py-[7px] border border-line rounded" type="search" placeholder="Chercher un titre, un compositeur…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Chercher" autoFocus />
              <label className={TOOL}>
                Afficher
                <select className={SELECT} value={kinds} onChange={(e) => setKinds(e.target.value as Kinds)}>
                  <option value="all">Tout ({total("all")})</option>
                  <option value="prisma">Partitions Prisma ({total("prisma")})</option>
                  <option value="musicxml">MusicXML à importer ({total("musicxml")})</option>
                </select>
              </label>
              <label className={TOOL}>
                Trier par
                <select className={SELECT} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              {view === "thumbs" && (
                <label className="inline-flex items-center gap-1.5 text-muted whitespace-nowrap cursor-pointer" title="Les vignettes montrent chaque partition avec ses propres options, si elle en a ; sinon avec les options générales">
                  <input type="checkbox" checked={thumbsOwn} onChange={(e) => setThumbsOwn(e.target.checked)} />
                  Options de chaque partition
                </label>
              )}
              <ButtonGroup className="ml-auto" label="Présentation">
                <Button size="icon" pressed={view === "list"} onClick={() => setView("list")} title="En liste" aria-label="En liste">
                  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
                    <path fill="currentColor" d="M1.5 3h2v2h-2zM5.5 3.25h9v1.5h-9zM1.5 7h2v2h-2zM5.5 7.25h9v1.5h-9zM1.5 11h2v2h-2zM5.5 11.25h9v1.5h-9z" />
                  </svg>
                </Button>
                <Button size="icon" pressed={view === "thumbs"} onClick={() => setView("thumbs")} title="En vignettes : le haut de la première page" aria-label="En vignettes">
                  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
                    <path fill="currentColor" d="M1.5 1.5h5.5v5.5h-5.5zM9 1.5h5.5v5.5H9zM1.5 9h5.5v5.5h-5.5zM9 9h5.5v5.5H9z" />
                  </svg>
                </Button>
              </ButtonGroup>
            </div>
            {!state.entries.length && <p className={NOTE}>Aucune partition (.prisma ou MusicXML) dans ce dossier.</p>}
            {state.entries.length > 0 && !count && (
              <p className={NOTE}>{query.trim() ? `Aucun morceau ne correspond à « ${query.trim()} ».` : kinds === "prisma" ? "Aucune partition Prisma dans ce dossier." : "Aucun MusicXML à importer dans ce dossier."}</p>
            )}
            {groups.map((g) => (
              <section key={g.folder}>
                {g.folder && <h2 className="mx-0 mt-6 mb-1.5 text-[13px] uppercase tracking-[.06em] text-muted">{g.folder}</h2>}
                {view === "thumbs" ? (
                  <ul className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-[18px] m-0 px-0 pt-1 pb-0 list-none">
                    {g.entries.map((e) => (
                      <li key={e.path}>
                        <button className={`flex flex-col gap-0.5 h-full p-2 rounded-md ${ENTRY}`} onClick={() => onOpen(e)} title={e.path}>
                          <ThumbView entry={e} options={thumbsOwn && e.own ? { ...options, ...e.own } : options} />
                          <span className="font-semibold">{titleOf(e)}</span>
                          <span className="text-left text-[13px] text-muted">{e.composer ?? "\u00a0"}</span>
                          <span className={`${META} flex-wrap text-[11px]`}>
                            {sort === "recent" && e.folder ? `${e.folder}/` : ""}
                            {e.name}
                            {e.kind === "musicxml" && <span className="px-1.5 rounded-[3px] bg-accent-12 text-accent">à importer</span>}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                <ul className="m-0 p-0 list-none border-t border-line">
                  {g.entries.map((e) => (
                    <li key={e.path} className="border-b border-line">
                      <button className={`grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 px-2 py-2.5 rounded-none ${ENTRY}`} onClick={() => onOpen(e)} title={e.path}>
                        <span className="font-semibold">{titleOf(e)}</span>
                        {e.composer && <span className="text-right text-muted">{e.composer}</span>}
                        <span className={`${META} text-[12px]`}>
                          {sort === "recent" && e.folder ? `${e.folder}/` : ""}
                          {e.name}
                          {e.kind === "musicxml" && <span className="px-1.5 rounded-[3px] bg-accent-12 text-accent">à importer</span>}
                          <span className="ml-auto">{new Date(e.modified).toLocaleDateString("fr-FR")}</span>
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
    const seen = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { root: el.closest("[data-library]"), rootMargin: "300px" });
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
    <span className="relative block aspect-[210/150] overflow-hidden mb-1.5 bg-white border border-line rounded-[3px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] [&_.page]:w-full [&_.page]:h-auto [&_.page]:shadow-none [&_.page]:pointer-events-none" ref={ref} aria-hidden>
      {result?.thumb && <PageView page={result.thumb.page} total={result.thumb.total} meta={result.thumb.meta} options={options} still />}
      {result?.error && <span className="absolute inset-0 grid place-items-center p-3 text-center text-muted text-[12px]">Aperçu impossible : le fichier ne se lit pas</span>}
      {result && !result.thumb && !result.error && <span className="absolute inset-0 grid place-items-center p-3 text-center text-muted text-[12px]">Aucune mesure</span>}
    </span>
  );
}
