import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Score } from "../core/index.ts";
import { DEFAULT_BPM, player } from "./player.ts";
import { follow } from "./follow.ts";
import { MAX_TEMPO, MIN_TEMPO } from "./piece.ts";
import { PIANO, INSTRUMENTS } from "./instruments.ts";
import { staffNames } from "./staves.ts";
import { usePopover } from "./popover.ts";

const labels = { idle: "Écouter", loading: "Chargement du piano… (cliquer pour annuler)", playing: "Pause", paused: "Reprendre" };

/** Icône des boutons de lecture, dessinée dans un carré de 16. */
function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <path d={d} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

const MIN_BPM = MIN_TEMPO;
const MAX_BPM = MAX_TEMPO;

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
  /** Les portées muettes (leurs numéros) : on les joue soi-même pendant que l'app joue les autres. */
  muted: number[];
  onMuted: (staves: number[]) => void;
  /** L'instrument de chaque partie, et son changement. */
  instruments: string[];
  onInstrument: (part: number, instrument: string) => void;
  /** Le tempo choisi pour ce morceau, ou null : celui de la partition. */
  tempo: number | null;
  onTempo: (bpm: number | null) => void;
};

export function ListenControls({ score, disabled, metronome, onMetronome, muted, onMuted, instruments, onInstrument, tempo, onTempo }: Props) {
  const { state, error, entry: playing, entries } = useSyncExternalStore(player.subscribe, player.getSnapshot);
  const following = useSyncExternalStore(follow.subscribe, follow.enabled);
  const entry = playing ?? 0;
  const written = score?.meta.bpm ?? DEFAULT_BPM;
  const chosen = tempo;
  const setChosen = onTempo;
  const [draft, setDraft] = useState<string | null>(null); // saisie en cours, pas encore un tempo valable
  const bpm = chosen ?? written;
  useEffect(() => player.setTempo(bpm), [bpm]);

  const edit = (text: string) => {
    setDraft(text);
    const n = Number(text);
    if (Number.isInteger(n) && n >= MIN_BPM && n <= MAX_BPM) setChosen(n === written ? null : n);
  };
  const toggle = () => {
    if (state === "playing") player.pause();
    else if (state === "loading") player.stop();
    else if (score) {
      follow.release();
      player.play(score, bpm);
    }
  };
  /** Revenir au début, à une section : la partition y retourne sans attendre. */
  const go = (move: () => void) => () => {
    follow.release();
    move();
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
        <button onClick={go(() => player.rewind())} disabled={disabled} title="Revenir au début du morceau" aria-label="Revenir au début">
          <Icon d="M2 3h2v10H2zM9 3v10L4 8zM14 3v10L9 8z" />
        </button>
        <button onClick={go(() => player.previous())} disabled={disabled} title="Début de la section (deux clics : section précédente)" aria-label="Section précédente">
          <Icon d="M3 3h2v10H3zM13 3v10L5 8z" />
        </button>
        <button className="listen" onClick={toggle} disabled={disabled} title={labels[state]} aria-label={labels[state]}>
          {state === "loading" ? <span className="loading">…</span> : <Icon d={state === "playing" ? "M4 3h3v10H4zM9 3h3v10H9z" : "M4 2.5v11L13 8z"} />}
        </button>
        <button onClick={go(() => player.next())} disabled={disabled || entry + 1 >= entries} title="Section suivante" aria-label="Section suivante">
          <Icon d="M11 3h2v10h-2zM3 3v10l8-5z" />
        </button>
        <button onClick={() => player.stop()} disabled={state === "idle"} title="Arrêter et revenir au début" aria-label="Arrêter">
          <Icon d="M3.5 3.5h9v9h-9z" />
        </button>
      </span>
      <span className="transport toggles">
        <button
          className={following ? "on" : undefined}
          aria-pressed={following}
          onClick={() => follow.set(!following)}
          title={following ? "Suivre la lecture : la partition suit le curseur, et y revient une seconde après qu'on l'a fait défiler à la main" : "Suivre la lecture : arrêté"}
          aria-label="Suivre la lecture"
        >
          <Icon d="M8 2.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11zM8 4a4 4 0 1 1 0 8a4 4 0 1 1 0-8zM8 6.3a1.7 1.7 0 1 1 0 3.4a1.7 1.7 0 1 1 0-3.4zM7.25 .5h1.5v2h-1.5zM7.25 13.5h1.5v2h-1.5zM.5 7.25h2v1.5h-2zM13.5 7.25h2v1.5h-2z" />
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
        <PartsMenu score={score} muted={muted} onMuted={onMuted} instruments={instruments} onInstrument={onInstrument} />
      </span>
    </>
  );
}

/**
 * Les portées jouées : un bouton qui coupe ou rend la musique d'un clic (le métronome seul reste),
 * et sa flèche, qui ouvre la liste des parties, chacune avec son instrument, et de leurs portées,
 * chacune à cocher pour l'entendre ou la rendre muette (pour la jouer soi-même). La musique
 * rendue retrouve les portées choisies avant.
 */
function PartsMenu({ score, muted, onMuted, instruments, onInstrument }: { score?: Score; muted: number[]; onMuted: (staves: number[]) => void; instruments: string[]; onInstrument: (part: number, instrument: string) => void }) {
  const { open, setOpen, root } = usePopover<HTMLSpanElement>();
  // le dernier choix où une portée au moins jouait : la musique rendue le retrouve
  const before = useRef<number[]>([]);
  const names = score ? staffNames(score.parts) : [];
  // les portées de chaque partie, nommées sans le nom de la partie quand il les précède
  const groups: { name?: string; staves: { k: number; label: string }[] }[] = [];
  let k = 0;
  for (const part of score?.parts ?? []) {
    const staves = Array.from({ length: part.staves }, () => {
      const full = names[k];
      const label = part.staves > 1 && full.includes(" — ") ? full.split(" — ")[1] : full;
      return { k: k++, label: part.staves > 1 ? label[0].toUpperCase() + label.slice(1) : label };
    });
    groups.push({ name: part.name, staves });
  }
  const all = names.map((_, k) => k);
  const silent = names.length > 0 && muted.length >= names.length;
  const state = !muted.length ? "on" : silent ? undefined : "on partial";
  const title = !muted.length ? "Musique : toutes les portées jouées" : silent ? "Musique : coupée (le métronome seul)" : `Musique : ${muted.length} portée${muted.length > 1 ? "s" : ""} muette${muted.length > 1 ? "s" : ""} sur ${names.length}`;
  const toggle = (k: number) => onMuted(muted.includes(k) ? muted.filter((x) => x !== k) : [...muted, k].sort((a, b) => a - b));
  if (!silent) before.current = muted;
  const music = () => onMuted(silent ? before.current : all);
  return (
    <span className="parts-menu" ref={root}>
      <button className={state} aria-pressed={!silent} onClick={music} disabled={!names.length} title={title} aria-label="Musique">
        <Icon d="M6 2.5 13 1v9.2a2.3 2.3 0 1 1-1.5-2.15V4.1L7.5 5v6.7A2.3 2.3 0 1 1 6 9.55z" />
      </button>
      <button className={`more${open ? " open" : ""}`} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((v) => !v)} disabled={!names.length} title="Portées jouées et instruments des parties" aria-label="Parties et instruments">
        <svg width="8" height="16" viewBox="0 0 8 16" aria-hidden="true">
          <path d="M1 6.5h6L4 10z" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div className="popover parts-list" role="dialog" aria-label="Parties et instruments">
          <p className="popover-title">Parties et instruments</p>
          {groups.map((g, i) => {
            const instrument = (
              <select value={instruments[i] ?? PIANO} onChange={(e) => onInstrument(i, e.target.value)} aria-label={`Instrument${g.name ? ` : ${g.name}` : ""}`} title="L'instrument de la partie, à l'écoute">
                {INSTRUMENTS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            );
            // une partie d'une portée : une seule ligne ; sinon son nom et son instrument, puis ses portées
            if (g.staves.length === 1)
              return (
                <div key={i} className="part-row">
                  <label>
                    <input type="checkbox" checked={!muted.includes(g.staves[0].k)} onChange={() => toggle(g.staves[0].k)} />
                    {g.staves[0].label}
                  </label>
                  {instrument}
                </div>
              );
            return (
              <div key={i} className="part-group">
                <div className="part-row">
                  <span className="part-name">{g.name || "Partie"}</span>
                  {instrument}
                </div>
                {g.staves.map((p) => (
                  <label key={p.k} className="part-staff">
                    <input type="checkbox" checked={!muted.includes(p.k)} onChange={() => toggle(p.k)} />
                    {p.label}
                  </label>
                ))}
              </div>
            );
          })}
          <div className="popover-actions">
            <button onClick={() => onMuted([])} disabled={!muted.length}>
              Toutes
            </button>
            <button onClick={() => onMuted(all)} disabled={silent}>
              Aucune
            </button>
          </div>
          <p className="popover-hint">Une portée muette n'est pas jouée : à vous de la jouer, avec le métronome au besoin. L'instrument d'une partie se devine d'après son nom ; un autre choix vaut pour ce morceau.</p>
        </div>
      )}
    </span>
  );
}
