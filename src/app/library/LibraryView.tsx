/**
 * La bibliothèque : les morceaux du dossier choisi (un dossier de l'ordinateur, ou le dossier de
 * Prisma sur pCloud), rangés par sous-dossier, à chercher et à trier, en liste ou en vignettes (le
 * haut de leur première page) ; un clic ouvre le morceau. Sans bibliothèque, le choix entre les deux,
 * expliqué ; sur pCloud, où Prisma ne voit que son dossier, comment y mettre ses partitions.
 */
import { FolderIcon, RefreshIcon } from "../ui/icons.tsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageView } from "../score/PageView.tsx";
import type { RenderOptions } from "../options/options.ts";
import { engraveOptions } from "../score/render.ts";
import { thumbOf } from "./thumbs.ts";
import type { Thumb } from "./thumbs.ts";
import { pickFolder } from "./diskLibrary.ts";
import { scan } from "./library.ts";
import { SORTS, countOf, groupEntries, titleOf } from "./browse.ts";
import type { Kinds, LibraryView as View, Sort } from "./browse.ts";
import { PCLOUD_FOLDER, PcloudAuthError, connect, disconnect, session } from "./pcloud.ts";
import { available, choose, savedSource } from "./sources.ts";
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

const SORT_KEY = "prisma:library-sort";
const loadSort = (): Sort => {
  try {
    const text = localStorage.getItem(SORT_KEY);
    return SORTS.some((sort) => sort.value === text) ? (text as Sort) : "title";
  } catch {
    return "title";
  }
};

const KINDS_KEY = "prisma:library-kinds";
const loadKinds = (): Kinds => {
  try {
    const key = localStorage.getItem(KINDS_KEY);
    return key === "prisma" || key === "musicxml" ? key : "all";
  } catch {
    return "all";
  }
};

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
  | { kind: "locked"; source: LibrarySource; reason?: string }
  | { kind: "ready"; source: LibrarySource; entries: LibraryEntry[] }
  | { kind: "error"; message: string };

export function LibraryView({
  options,
  onOpen,
  onClose,
}: {
  options: RenderOptions;
  onOpen: (entry: LibraryEntry) => void;
  onClose: () => void;
}) {
  const [view, setViewState] = useState<View>(loadView);
  const setView = (next: View) => {
    setViewState(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
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
  const setThumbsOwn = (value: boolean) => {
    setThumbsOwnState(value);
    try {
      localStorage.setItem(THUMBS_OWN_KEY, String(value));
    } catch {
      /* stockage indisponible : sans conséquence */
    }
  };
  const [state, setState] = useState<State>(available.disk || available.pcloud ? { kind: "loading" } : { kind: "unsupported" });
  const [query, setQuery] = useState("");
  const [sort, setSortState] = useState<Sort>(loadSort);
  const [kinds, setKindsState] = useState<Kinds>(loadKinds);
  const setKinds = (next: Kinds) => {
    setKindsState(next);
    try {
      localStorage.setItem(KINDS_KEY, next);
    } catch {
      /* stockage indisponible : sans conséquence */
    }
  };
  const setSort = (next: Sort) => {
    setSortState(next);
    try {
      localStorage.setItem(SORT_KEY, next);
    } catch {
      /* stockage indisponible : sans conséquence */
    }
  };

  const load = async (source: LibrarySource, ask = false) => {
    try {
      if (!(await source.access(ask))) return setState({ kind: "locked", source });
      setState({ kind: "loading" });
      setState({ kind: "ready", source, entries: await scan(source) });
    } catch (error) {
      // la connexion à pCloud ne vaut plus : la redonner
      if (error instanceof PcloudAuthError) return setState({ kind: "locked", source, reason: error.message });
      setState({ kind: "error", message: (error as Error).message });
    }
  };
  useEffect(() => {
    if (!available.disk && !available.pcloud) return;
    savedSource().then((source) => (source ? load(source) : setState({ kind: "none" })));
  }, []);
  const chooseFolder = async () => {
    try {
      const source = await pickFolder();
      if (!source) return;
      choose("disk");
      await load(source, true);
    } catch (error) {
      setState({ kind: "error", message: (error as Error).message });
    }
  };
  const choosePcloud = () => {
    choose("pcloud");
    connect();
  };
  const leavePcloud = () => {
    disconnect();
    choose(null);
    setState({ kind: "none" });
  };

  const groups = useMemo(
    () => (state.kind === "ready" ? groupEntries(state.entries, query, sort, kinds) : []),
    [state, query, sort, kinds],
  );
  const count = groups.reduce((sum, group) => sum + group.entries.length, 0);
  const total = (shown: Kinds) => (state.kind === "ready" ? countOf(state.entries, shown) : 0);

  return (
    <main data-library className="flex-1 overflow-auto bg-white">
      <BackButton onClick={onClose} shortcut="Ctrl+B" />
      <div className="max-w-[860px] mx-auto px-8 pt-2 pb-16">
        <header>
          <h1 className="mx-0 mt-2 mb-1 text-[26px]">Bibliothèque</h1>
          {(state.kind === "ready" || state.kind === "locked") && (
            <p className="flex flex-wrap items-center gap-2 mt-0 mb-4 text-muted">
              {state.source.label}
              <Button
                size="icon"
                onClick={() => setState({ kind: "none" })}
                title="Changer de bibliothèque : un autre dossier, ou pCloud"
                aria-label="Changer de bibliothèque"
              >
                <FolderIcon />
              </Button>
              {state.kind === "ready" && (
                <Button size="icon" onClick={() => load(state.source)} title="Actualiser : relire le dossier" aria-label="Actualiser">
                  <RefreshIcon />
                </Button>
              )}
              {state.source.kind === "pcloud" && session() && (
                <Button size="small" onClick={leavePcloud} title="Se déconnecter de pCloud, dans ce navigateur">
                  Se déconnecter
                </Button>
              )}
            </p>
          )}
          {state.kind === "ready" && state.source.kind === "pcloud" && state.entries.length > 0 && (
            <p className={`${NOTE} -mt-2 mb-4 text-[13px]`}>
              Prisma ne voit que ce dossier de votre pCloud : vos partitions doivent y être.
            </p>
          )}
        </header>

        {state.kind === "unsupported" && (
          <p className={NOTE}>
            La bibliothèque a besoin de garder l'accès à un dossier de votre disque, ce que seuls Chrome et Edge savent faire. Ici, ouvrez
            vos morceaux par Fichier › Ouvrir, ou en les glissant dans la fenêtre.
          </p>
        )}
        {state.kind === "loading" && <p className={NOTE}>Lecture du dossier…</p>}
        {state.kind === "none" && <Sources onFolder={chooseFolder} onPcloud={choosePcloud} />}
        {state.kind === "locked" && (
          <div className={NOTE}>
            <p className="mt-0 mb-3">{state.source.locked.hint}</p>
            {state.reason && <p className="-mt-1 mb-3 text-[13px] text-error">{state.reason}</p>}
            <Button kind="primary" onClick={() => load(state.source, true)}>
              {state.source.locked.action}
            </Button>
          </div>
        )}
        {state.kind === "error" && (
          <div className={NOTE}>
            <p className="mt-0 mb-3">Lecture du dossier impossible : {state.message}</p>
            <Button kind="primary" onClick={() => setState({ kind: "none" })}>
              Choisir une bibliothèque
            </Button>
          </div>
        )}

        {state.kind === "ready" && (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 mt-0 mb-5">
              <input
                className="flex-[1_1_100%] min-w-0 px-2.5 py-[7px] border border-line rounded"
                type="search"
                placeholder="Chercher un titre, un compositeur…"
                value={query}
                onChange={(changeEvent) => setQuery(changeEvent.target.value)}
                aria-label="Chercher"
                autoFocus
              />
              <label className={TOOL}>
                Afficher
                <select className={SELECT} value={kinds} onChange={(event) => setKinds(event.target.value as Kinds)}>
                  <option value="all">Tout ({total("all")})</option>
                  <option value="prisma">Partitions Prisma ({total("prisma")})</option>
                  <option value="musicxml">MusicXML à importer ({total("musicxml")})</option>
                </select>
              </label>
              <label className={TOOL}>
                Trier par
                <select className={SELECT} value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
                  {SORTS.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </label>
              {view === "thumbs" && (
                <label
                  className="inline-flex items-center gap-1.5 text-muted whitespace-nowrap cursor-pointer"
                  title="Les vignettes montrent chaque partition avec ses propres options, si elle en a ; sinon avec les options générales"
                >
                  <input type="checkbox" checked={thumbsOwn} onChange={(event) => setThumbsOwn(event.target.checked)} />
                  Options de chaque partition
                </label>
              )}
              <ButtonGroup className="ml-auto" label="Présentation">
                <Button size="icon" pressed={view === "list"} onClick={() => setView("list")} title="En liste" aria-label="En liste">
                  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
                    <path
                      fill="currentColor"
                      d="M1.5 3h2v2h-2zM5.5 3.25h9v1.5h-9zM1.5 7h2v2h-2zM5.5 7.25h9v1.5h-9zM1.5 11h2v2h-2zM5.5 11.25h9v1.5h-9z"
                    />
                  </svg>
                </Button>
                <Button
                  size="icon"
                  pressed={view === "thumbs"}
                  onClick={() => setView("thumbs")}
                  title="En vignettes : le haut de la première page"
                  aria-label="En vignettes"
                >
                  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
                    <path fill="currentColor" d="M1.5 1.5h5.5v5.5h-5.5zM9 1.5h5.5v5.5H9zM1.5 9h5.5v5.5h-5.5zM9 9h5.5v5.5H9z" />
                  </svg>
                </Button>
              </ButtonGroup>
            </div>
            {!state.entries.length &&
              (state.source.kind === "pcloud" ? (
                <PcloudEmpty />
              ) : (
                <p className={NOTE}>Aucune partition (.prisma ou MusicXML) dans ce dossier.</p>
              ))}
            {state.entries.length > 0 && !count && (
              <p className={NOTE}>
                {query.trim()
                  ? `Aucun morceau ne correspond à « ${query.trim()} ».`
                  : kinds === "prisma"
                    ? "Aucune partition Prisma dans ce dossier."
                    : "Aucun MusicXML à importer dans ce dossier."}
              </p>
            )}
            {groups.map((group) => (
              <section key={group.folder}>
                {group.folder && <h2 className="mx-0 mt-6 mb-1.5 text-[13px] uppercase tracking-[.06em] text-muted">{group.folder}</h2>}
                {view === "thumbs" ? (
                  <ul className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-[18px] m-0 px-0 pt-1 pb-0 list-none">
                    {group.entries.map((libraryEntry) => (
                      <li key={libraryEntry.path}>
                        <button
                          className={`flex flex-col gap-0.5 h-full p-2 rounded-md ${ENTRY}`}
                          onClick={() => onOpen(libraryEntry)}
                          title={libraryEntry.path}
                        >
                          <ThumbView
                            entry={libraryEntry}
                            options={thumbsOwn && libraryEntry.own ? { ...options, ...libraryEntry.own } : options}
                          />
                          <span className="font-semibold">{titleOf(libraryEntry)}</span>
                          <span className="text-left text-[13px] text-muted">{libraryEntry.composer ?? "\u00a0"}</span>
                          <span className={`${META} flex-wrap text-[11px]`}>
                            {sort === "recent" && libraryEntry.folder ? `${libraryEntry.folder}/` : ""}
                            {libraryEntry.name}
                            {libraryEntry.kind === "musicxml" && (
                              <span className="px-1.5 rounded-[3px] bg-accent-12 text-accent">à importer</span>
                            )}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="m-0 p-0 list-none border-t border-line">
                    {group.entries.map((entry) => (
                      <li key={entry.path} className="border-b border-line">
                        <button
                          className={`grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 px-2 py-2.5 rounded-none ${ENTRY}`}
                          onClick={() => onOpen(entry)}
                          title={entry.path}
                        >
                          <span className="font-semibold">{titleOf(entry)}</span>
                          {entry.composer && <span className="text-right text-muted">{entry.composer}</span>}
                          <span className={`${META} text-[12px]`}>
                            {sort === "recent" && entry.folder ? `${entry.folder}/` : ""}
                            {entry.name}
                            {entry.kind === "musicxml" && <span className="px-1.5 rounded-[3px] bg-accent-12 text-accent">à importer</span>}
                            <span className="ml-auto">{new Date(entry.modified).toLocaleDateString("fr-FR")}</span>
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

/** Sans bibliothèque : le choix entre un dossier de l'ordinateur et pCloud, ce que permet chacun. */
function Sources({ onFolder, onPcloud }: { onFolder: () => void; onPcloud: () => void }) {
  return (
    <div className={`${NOTE} grid gap-5`}>
      <p className="m-0">
        La bibliothèque montre toutes vos partitions (.prisma et MusicXML) d'un dossier, sous-dossiers compris. Les fichiers restent où ils
        sont : Prisma les lit et les réécrit en place.
      </p>
      {available.disk && (
        <section className="grid gap-2 justify-items-start">
          <h2 className="m-0 text-ink text-[16px]">Un dossier de cet ordinateur</h2>
          <p className="m-0">Le dossier de votre choix, sur cet ordinateur seulement.</p>
          <Button kind="primary" onClick={onFolder}>
            Choisir un dossier
          </Button>
        </section>
      )}
      {available.pcloud && (
        <section className="grid gap-2 justify-items-start">
          <h2 className="m-0 text-ink text-[16px]">pCloud</h2>
          <p className="m-0">
            Vos partitions depuis tous vos appareils, tablette comprise. Prisma n'a accès qu'à un dossier de votre pCloud, « {PCLOUD_FOLDER}{" "}
            » : c'est là que vos partitions doivent être. Si vous avez pCloud Drive sur cet ordinateur, ce même dossier peut aussi servir de
            bibliothèque ici.
          </p>
          <Button kind={available.disk ? "normal" : "primary"} onClick={onPcloud}>
            Se connecter à pCloud
          </Button>
        </section>
      )}
    </div>
  );
}

/** Le dossier de Prisma sur pCloud, vide : comment y mettre ses partitions. */
function PcloudEmpty() {
  return (
    <div className={NOTE}>
      <p className="mt-0 mb-2">Aucune partition pour l'instant dans le dossier « {PCLOUD_FOLDER} » de votre pCloud. Pour en ajouter :</p>
      <ul className="m-0 pl-5 grid gap-1 list-disc">
        <li>déplacez-y vos fichiers .prisma et MusicXML, depuis pCloud (le site, l'application) ou pCloud Drive sur votre ordinateur ;</li>
        <li>ou ouvrez un morceau (Fichier › Ouvrir), puis Fichier › Enregistrer dans la bibliothèque.</li>
      </ul>
      <p className="mt-2 mb-0">Puis actualisez la bibliothèque.</p>
    </div>
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
    const seen = new IntersectionObserver(([observed]) => observed.isIntersecting && setVisible(true), {
      root: el.closest("[data-library]"),
      rootMargin: "300px",
    });
    seen.observe(el);
    return () => seen.disconnect();
  }, [visible]);
  useEffect(() => {
    if (!visible) return;
    let live = true;
    setResult(undefined);
    thumbOf(entry, JSON.parse(engraving)).then((cached) => live && setResult(cached));
    return () => {
      live = false;
    };
  }, [visible, entry, engraving]);
  return (
    <span
      className="relative block aspect-[210/150] overflow-hidden mb-1.5 bg-white border border-line rounded-[3px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] [&_.page]:w-full [&_.page]:h-auto [&_.page]:shadow-none [&_.page]:pointer-events-none"
      ref={ref}
      aria-hidden
    >
      {result?.thumb && <PageView page={result.thumb.page} total={result.thumb.total} meta={result.thumb.meta} options={options} still />}
      {result?.error && (
        <span className="absolute inset-0 grid place-items-center p-3 text-center text-muted text-[12px]">
          Aperçu impossible : le fichier ne se lit pas
        </span>
      )}
      {result && !result.thumb && !result.error && (
        <span className="absolute inset-0 grid place-items-center p-3 text-center text-muted text-[12px]">Aucune mesure</span>
      )}
    </span>
  );
}
