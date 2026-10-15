import { useEffect, useState, useSyncExternalStore } from "react";
import type { Score } from "../core/index.ts";
import { DEFAULT_BPM, player } from "./player.ts";

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
type Sound = { metronome: boolean; instruments: boolean };

export function ListenControls({ score, disabled, metronome, instruments, onSound }: { score?: Score; disabled: boolean; onSound: (sound: Sound) => void } & Sound) {
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
          onClick={() => onSound({ metronome: !metronome, instruments })}
          title={metronome ? "Métronome : marque les temps" : "Métronome : coupé"}
          aria-label="Métronome"
        >
          <Icon d="M6.2 1.5h3.6L13 14.5H3zM7 4.5l-.9 8h3.8l-.9-8zM8 11.8 12.6 3.6l.9.5-4.4 8z" />
        </button>
        <button
          className={instruments ? "on" : undefined}
          aria-pressed={instruments}
          onClick={() => onSound({ metronome, instruments: !instruments })}
          title={instruments ? "Instruments : joués" : "Instruments : coupés (le métronome seul)"}
          aria-label="Instruments"
        >
          <Icon d="M6 2.5 13 1v9.2a2.3 2.3 0 1 1-1.5-2.15V4.1L7.5 5v6.7A2.3 2.3 0 1 1 6 9.55z" />
        </button>
      </span>
    </>
  );
}
