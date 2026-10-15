import { useEffect, useState, useSyncExternalStore } from "react";
import type { Score } from "../core/index.ts";
import { DEFAULT_BPM, player } from "./player.ts";

const MIN_BPM = 20;
const MAX_BPM = 300;

/**
 * Commandes d'écoute de la barre : lecture, pause et arrêt, et le tempo, celui de la partition
 * par défaut, qu'on peut changer (même en cours de lecture) puis rétablir.
 */
export function ListenControls({ score, disabled }: { score?: Score; disabled: boolean }) {
  const { state, error } = useSyncExternalStore(player.subscribe, player.getSnapshot);
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
      <button className="listen" onClick={toggle} disabled={disabled}>
        {state === "loading" ? "Chargement du piano…" : state === "playing" ? "❚❚ Pause" : state === "paused" ? "▶ Reprendre" : "▶ Écouter"}
      </button>
      {state !== "idle" && (
        <button className="stop" onClick={() => player.stop()} title="Arrêter et revenir au début">
          ■
        </button>
      )}
    </>
  );
}
