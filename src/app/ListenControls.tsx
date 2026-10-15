import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Score } from "../core/index.ts";
import { DEFAULT_BPM, player } from "./player.ts";
import { partNames } from "./parts.ts";

const labels = { idle: "Écouter", loading: "Chargement du piano… (cliquer pour annuler)", playing: "Pause", paused: "Reprendre" };

/** Icône des boutons de lecture, dessinée dans un carré de 16. */
function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <path d={d} fill="currentColor" />
    </svg>
  );
}

const MIN_BPM = 20;
const MAX_BPM = 300;

/**
 * Commandes d'écoute de la barre : début, section précédente, lecture et pause, section suivante,
 * arrêt ; et le tempo, celui de la partition
 * par défaut, qu'on peut changer (même en cours de lecture) puis rétablir.
 */
type Props = {
  score?: Score;
  disabled: boolean;
  metronome: boolean;
  onMetronome: (on: boolean) => void;
  /** Les parties muettes (leurs numéros) : on les joue soi-même pendant que l'app joue les autres. */
  muted: number[];
  onMuted: (parts: number[]) => void;
};

export function ListenControls({ score, disabled, metronome, onMetronome, muted, onMuted }: Props) {
  const { state, error, entry: playing, entries } = useSyncExternalStore(player.subscribe, player.getSnapshot);
  const entry = playing ?? 0;
  const written = score?.meta.bpm ?? DEFAULT_BPM;
  const [chosen, setChosen] = useState<number | null>(null);
  const [draft, setDraft] = useState<string | null>(null); // saisie en cours, pas encore un tempo valable
  const bpm = chosen ?? written;
  // un nouveau tempo écrit dans la partition reprend la main
  useEffect(() => setChosen(null), [written]);
  useEffect(() => player.setTempo(bpm), [bpm]);

  const edit = (text: string) => {
    setDraft(text);
    const n = Number(text);
    if (Number.isInteger(n) && n >= MIN_BPM && n <= MAX_BPM) setChosen(n === written ? null : n);
  };
  const toggle = () => {
    if (state === "playing") player.pause();
    else if (state === "loading") player.stop();
    else if (score) player.play(score, bpm);
  };

  return (
    <>
      {error && (
        <span className="notice" role="status">
          {error}
        </span>
      )}
      <span className="spacer" />
      <span className="tempo" title={`Tempo de l'écoute, en temps par minute (${MIN_BPM} à ${MAX_BPM})`}>
        <input
          type="number"
          min={MIN_BPM}
          max={MAX_BPM}
          value={draft ?? bpm}
          onChange={(e) => edit(e.target.value)}
          onBlur={() => setDraft(null)}
          aria-label="Tempo de l'écoute"
        />
        {chosen !== null && (
          <button className="reset" onClick={() => (setChosen(null), setDraft(null))} title={`Revenir au tempo de la partition (${written} bpm)`}>
            ↺
          </button>
        )}
        <span className="unit">bpm</span>
      </span>
      <span className="transport">
        <button onClick={() => player.rewind()} disabled={disabled} title="Revenir au début du morceau" aria-label="Revenir au début">
          <Icon d="M2 3h2v10H2zM9 3v10L4 8zM14 3v10L9 8z" />
        </button>
        <button onClick={() => player.previous()} disabled={disabled} title="Début de la section (deux clics : section précédente)" aria-label="Section précédente">
          <Icon d="M3 3h2v10H3zM13 3v10L5 8z" />
        </button>
        <button className="listen" onClick={toggle} disabled={disabled} title={labels[state]} aria-label={labels[state]}>
          {state === "loading" ? <span className="loading">…</span> : <Icon d={state === "playing" ? "M4 3h3v10H4zM9 3h3v10H9z" : "M4 2.5v11L13 8z"} />}
        </button>
        <button onClick={() => player.next()} disabled={disabled || entry + 1 >= entries} title="Section suivante" aria-label="Section suivante">
          <Icon d="M11 3h2v10h-2zM3 3v10l8-5z" />
        </button>
        <button onClick={() => player.stop()} disabled={state === "idle"} title="Arrêter et revenir au début" aria-label="Arrêter">
          <Icon d="M3.5 3.5h9v9h-9z" />
        </button>
      </span>
      <span className="transport toggles">
        <button
          className={metronome ? "on" : undefined}
          aria-pressed={metronome}
          onClick={() => onMetronome(!metronome)}
          title={metronome ? "Métronome : marque les temps" : "Métronome : coupé"}
          aria-label="Métronome"
        >
          <Icon d="M6.2 1.5h3.6L13 14.5H3zM7 4.5l-.9 8h3.8l-.9-8zM8 11.8 12.6 3.6l.9.5-4.4 8z" />
        </button>
        <PartsMenu score={score} muted={muted} onMuted={onMuted} />
      </span>
    </>
  );
}

/**
 * Les parties jouées : un bouton qui coupe ou rend la musique d'un clic (le métronome seul reste),
 * et sa flèche, qui ouvre la liste des parties, chacune à cocher pour l'entendre ou la rendre
 * muette (pour la jouer soi-même). La musique rendue retrouve les parties choisies avant.
 */
function PartsMenu({ score, muted, onMuted }: { score?: Score; muted: number[]; onMuted: (parts: number[]) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  // le dernier choix où une partie au moins jouait : la musique rendue le retrouve
  const before = useRef<number[]>([]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", outside);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("mousedown", outside);
      window.removeEventListener("keydown", key);
    };
  }, [open]);
  const names = score ? partNames(score.instruments) : [];
  const all = names.map((_, k) => k);
  const silent = names.length > 0 && muted.length >= names.length;
  const state = !muted.length ? "on" : silent ? undefined : "on partial";
  const title = !muted.length ? "Musique : toutes les parties jouées" : silent ? "Musique : coupée (le métronome seul)" : `Musique : ${muted.length} partie${muted.length > 1 ? "s" : ""} muette${muted.length > 1 ? "s" : ""} sur ${names.length}`;
  const toggle = (k: number) => onMuted(muted.includes(k) ? muted.filter((x) => x !== k) : [...muted, k].sort((a, b) => a - b));
  if (!silent) before.current = muted;
  const music = () => onMuted(silent ? before.current : all);
  return (
    <span className="parts-menu" ref={root}>
      <button className={state} aria-pressed={!silent} onClick={music} disabled={!names.length} title={title} aria-label="Musique">
        <Icon d="M6 2.5 13 1v9.2a2.3 2.3 0 1 1-1.5-2.15V4.1L7.5 5v6.7A2.3 2.3 0 1 1 6 9.55z" />
      </button>
      <button className={`more${open ? " open" : ""}`} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((v) => !v)} disabled={!names.length} title="Choisir les parties jouées" aria-label="Parties jouées">
        <svg width="8" height="16" viewBox="0 0 8 16" aria-hidden="true">
          <path d="M1 6.5h6L4 10z" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div className="parts-list" role="dialog" aria-label="Parties jouées">
          <p className="parts-title">Parties jouées</p>
          {names.map((name, k) => (
            <label key={k}>
              <input type="checkbox" checked={!muted.includes(k)} onChange={() => toggle(k)} />
              {name}
            </label>
          ))}
          <div className="parts-actions">
            <button onClick={() => onMuted([])} disabled={!muted.length}>
              Toutes
            </button>
            <button onClick={() => onMuted(all)} disabled={silent}>
              Aucune
            </button>
          </div>
          <p className="parts-hint">Une partie muette n'est pas jouée : à vous de la jouer, avec le métronome au besoin.</p>
        </div>
      )}
    </span>
  );
}
