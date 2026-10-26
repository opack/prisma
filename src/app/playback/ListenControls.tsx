import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Score } from "../../core/index.ts";
import { DEFAULT_BPM, player } from "./player.ts";
import { follow } from "../score/follow.ts";
import { MAX_TEMPO, MIN_TEMPO } from "../options/piece.ts";
import { INSTRUMENTS, PIANO, instrumentLabel, scoreInstrument } from "./instruments.ts";
import { MAX_VOLUME, MIN_VOLUME } from "../options/piece.ts";
import { staffNames } from "./staves.ts";
import { Popover } from "../ui/popover/Popover.tsx";
import { PopoverCheck } from "../ui/popover/PopoverCheck.tsx";
import { PopoverChoices } from "../ui/popover/PopoverChoices.tsx";
import { PopoverHint } from "../ui/popover/PopoverHint.tsx";
import { usePopover } from "../ui/popover/usePopover.ts";

/** Les boutons de lecture, en icônes, collés en un seul groupe : le premier et le dernier arrondis. */
const TRANSPORT = "flex items-center justify-center px-0 -ml-px rounded-none first:ml-0 first:rounded-[4px_0_0_4px] last:rounded-[0_4px_4px_0] only:rounded";
/** Allumé (le métronome, la musique, le suivi), ou éteint. */
const ON = "relative z-1 text-accent bg-accent-12 border-accent";
const toggled = (on: boolean) => (on ? ON : "text-muted");
/** Un bouton à réglages (le métronome, la musique) : le bouton, puis sa flèche, collée. */
const TOGGLE = "flex items-center justify-center w-[2.4em] px-0 ml-0 rounded-[4px_0_0_4px]";
const more = (open: boolean) => `flex items-center justify-center w-[1.4em] px-0 -ml-px rounded-[0_4px_4px_0] ${open ? "text-accent" : "text-muted enabled:hover:text-accent"}`;
/** Une ligne de la liste des parties : la partie (ou sa portée), son instrument, son volume. */
const ROW = "flex items-center justify-between gap-2.5";
/** Toutes, Aucune : sous la liste, à la taille du texte. */
const ACTION = "flex items-center justify-center w-auto m-0 -ml-px px-2.5 py-[3px] text-ink bg-white rounded-none first:ml-0 first:rounded-[4px_0_0_4px]";
import { CLICK_GRIDS } from "../options/options.ts";
import type { ClickGrid } from "./performance.ts";

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
  /** Ce que bat le métronome (l'option « Battre »), et son changement. */
  clickGrid: ClickGrid;
  onClickGrid: (grid: ClickGrid) => void;
  /** Les portées muettes (leurs numéros) : on les joue soi-même pendant que l'app joue les autres. */
  muted: number[];
  onMuted: (staves: number[]) => void;
  /** L'instrument de chaque partie, et son changement. */
  instruments: string[];
  onInstrument: (part: number, instrument: string) => void;
  /** Le volume de chaque partie (en décibels, 0 tel quel), et son changement. */
  volumes: number[];
  onVolume: (part: number, db: number) => void;
  /** Le tempo choisi pour ce morceau, ou null : celui de la partition. */
  tempo: number | null;
  onTempo: (bpm: number | null) => void;
};

export function ListenControls({ score, disabled, metronome, onMetronome, clickGrid, onClickGrid, muted, onMuted, instruments, onInstrument, volumes, onVolume, tempo, onTempo }: Props) {
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
        <span className="ml-3 text-accent whitespace-nowrap" role="status">
          {error}
        </span>
      )}
      <span className="flex-1" />
      <span className="flex items-center pr-1.5 bg-white border border-line rounded focus-within:border-muted" title={`Tempo de l'écoute, en temps par minute (${MIN_BPM} à ${MAX_BPM})`}>
        <input
          type="number"
          min={MIN_BPM}
          max={MAX_BPM}
          value={draft ?? bpm}
          onChange={(e) => edit(e.target.value)}
          onBlur={() => setDraft(null)}
          className="w-[3.4em] pl-1.5 pr-0.5 py-1 text-right bg-transparent border-0 outline-none"
          aria-label="Tempo de l'écoute"
        />
        {chosen !== null && (
          <button className="m-0 px-1 py-0 text-[1em] leading-none text-muted bg-none border-0 cursor-pointer hover:text-ink" onClick={() => (setChosen(null), setDraft(null))} title={`Revenir au tempo de la partition (${written} bpm)`}>
            ↺
          </button>
        )}
        <span className="ml-0.5 text-muted text-[0.9em]">bpm</span>
      </span>
      <span className="flex">
        <button className={`${TRANSPORT} w-[2.4em]`} onClick={go(() => player.rewind())} disabled={disabled} title="Revenir au début du morceau" aria-label="Revenir au début">
          <Icon d="M2 3h2v10H2zM9 3v10L4 8zM14 3v10L9 8z" />
        </button>
        <button className={`${TRANSPORT} w-[2.4em]`} onClick={go(() => player.previous())} disabled={disabled} title="Début de la section (deux clics : section précédente)" aria-label="Section précédente">
          <Icon d="M3 3h2v10H3zM13 3v10L5 8z" />
        </button>
        <button className={`${TRANSPORT} w-[3em]`} onClick={toggle} disabled={disabled} title={labels[state]} aria-label={labels[state]}>
          {state === "loading" ? <span className="leading-[14px]">…</span> : <Icon d={state === "playing" ? "M4 3h3v10H4zM9 3h3v10H9z" : "M4 2.5v11L13 8z"} />}
        </button>
        <button className={`${TRANSPORT} w-[2.4em]`} onClick={go(() => player.next())} disabled={disabled || entry + 1 >= entries} title="Section suivante" aria-label="Section suivante">
          <Icon d="M11 3h2v10h-2zM3 3v10l8-5z" />
        </button>
        <button className={`${TRANSPORT} w-[2.4em]`} onClick={() => player.stop()} disabled={state === "idle"} title="Arrêter et revenir au début" aria-label="Arrêter">
          <Icon d="M3.5 3.5h9v9h-9z" />
        </button>
      </span>
      <span className="flex">
        <button
          className={`${TRANSPORT} w-[2.4em] ${toggled(following)}`}
          aria-pressed={following}
          onClick={() => follow.set(!following)}
          title={following ? "Suivre la lecture : la partition suit le curseur, et y revient une seconde après qu'on l'a fait défiler à la main" : "Suivre la lecture : arrêté"}
          aria-label="Suivre la lecture"
        >
          <Icon d="M8 2.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11zM8 4a4 4 0 1 1 0 8a4 4 0 1 1 0-8zM8 6.3a1.7 1.7 0 1 1 0 3.4a1.7 1.7 0 1 1 0-3.4zM7.25 .5h1.5v2h-1.5zM7.25 13.5h1.5v2h-1.5zM.5 7.25h2v1.5h-2zM13.5 7.25h2v1.5h-2z" />
        </button>
      </span>
      <span className="flex">
        <MetronomeMenu metronome={metronome} onMetronome={onMetronome} clickGrid={clickGrid} onClickGrid={onClickGrid} />
        <PartsMenu score={score} muted={muted} onMuted={onMuted} instruments={instruments} onInstrument={onInstrument} volumes={volumes} onVolume={onVolume} />
      </span>
    </>
  );
}

/**
 * Le métronome : un bouton qui l'allume ou le coupe, et sa flèche, qui ouvre le choix de ce qu'il
 * bat (l'option « Battre », la même que dans les options).
 */
type MetronomeProps = { metronome: boolean; onMetronome: (on: boolean) => void; clickGrid: ClickGrid; onClickGrid: (grid: ClickGrid) => void };

function MetronomeMenu({ metronome, onMetronome, clickGrid, onClickGrid }: MetronomeProps) {
  const { open, setOpen, root } = usePopover<HTMLSpanElement>();
  return (
    <span className="relative flex" ref={root}>
      <button className={`${TOGGLE} ${toggled(metronome)}`} aria-pressed={metronome} onClick={() => onMetronome(!metronome)} title={metronome ? "Métronome : marque les temps" : "Métronome : coupé"} aria-label="Métronome">
        <Icon d="M6.2 1.5h3.6L13 14.5H3zM7 4.5l-.9 8h3.8l-.9-8zM8 11.8 12.6 3.6l.9.5-4.4 8z" />
      </button>
      <button className={more(open)} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((v) => !v)} title="Ce que bat le métronome" aria-label="Battre">
        <svg width="8" height="16" viewBox="0 0 8 16" aria-hidden="true">
          <path d="M1 6.5h6L4 10z" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <Popover label="Battre" title="Battre" className="min-w-[240px] w-[280px]">
          <PopoverChoices name="click-grid-bar" options={CLICK_GRIDS} value={clickGrid} onChange={onClickGrid} />
        </Popover>
      )}
    </span>
  );
}

/**
 * Les portées jouées : un bouton qui coupe ou rend la musique d'un clic (le métronome seul reste),
 * et sa flèche, qui ouvre la liste des parties, chacune avec son instrument, et de leurs portées,
 * chacune à cocher pour l'entendre ou la rendre muette (pour la jouer soi-même). La musique
 * rendue retrouve les portées choisies avant.
 */
type PartsProps = { score?: Score; muted: number[]; onMuted: (staves: number[]) => void; instruments: string[]; onInstrument: (part: number, instrument: string) => void; volumes: number[]; onVolume: (part: number, db: number) => void };

function PartsMenu({ score, muted, onMuted, instruments, onInstrument, volumes, onVolume }: PartsProps) {
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
  // toutes les portées jouées : allumé ; quelques-unes : allumé, à rayures
  const state = !muted.length ? toggled(true) : silent ? toggled(false) : `${ON} bg-[repeating-linear-gradient(135deg,var(--color-accent-12)_0_4px,#fff_4px_8px)]`;
  const title = !muted.length ? "Musique : toutes les portées jouées" : silent ? "Musique : coupée (le métronome seul)" : `Musique : ${muted.length} portée${muted.length > 1 ? "s" : ""} muette${muted.length > 1 ? "s" : ""} sur ${names.length}`;
  const toggle = (k: number) => onMuted(muted.includes(k) ? muted.filter((x) => x !== k) : [...muted, k].sort((a, b) => a - b));
  if (!silent) before.current = muted;
  const music = () => onMuted(silent ? before.current : all);
  return (
    <span className="relative flex ml-[5px]" ref={root}>
      <button className={`${TOGGLE} ${state}`} aria-pressed={!silent} onClick={music} disabled={!names.length} title={title} aria-label="Musique">
        <Icon d="M6 2.5 13 1v9.2a2.3 2.3 0 1 1-1.5-2.15V4.1L7.5 5v6.7A2.3 2.3 0 1 1 6 9.55z" />
      </button>
      <button className={more(open)} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((v) => !v)} disabled={!names.length} title="Portées jouées et instruments des parties" aria-label="Parties et instruments">
        <svg width="8" height="16" viewBox="0 0 8 16" aria-hidden="true">
          <path d="M1 6.5h6L4 10z" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <Popover label="Parties et instruments" title="Parties et instruments" className="min-w-[300px]">
          {groups.map((g, i) => {
            // l'instrument de la partition (écrit après le nom de la partie, ou deviné) ; un autre choix se rétablit d'un clic
            const fromScore = score ? scoreInstrument(score.parts[i]) : PIANO;
            const chosen = (instruments[i] ?? PIANO) !== fromScore;
            const instrument = (
              <span className="inline-flex items-center gap-1">
                <select className="max-w-[11em] px-1 py-0.5 bg-white border border-line rounded" value={instruments[i] ?? PIANO} onChange={(e) => onInstrument(i, e.target.value)} aria-label={`Instrument${g.name ? ` : ${g.name}` : ""}`} title={chosen ? `Choisi pour ce morceau ; la partition donne : ${instrumentLabel(fromScore)}` : "L'instrument de la partie, à l'écoute, tel que la partition le donne"}>
                  {INSTRUMENTS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {chosen && (
                  <button className="flex items-center justify-center w-auto m-0 px-1.5 py-px text-accent bg-white rounded" onClick={() => onInstrument(i, fromScore)} title={`Reprendre l'instrument de la partition (${instrumentLabel(fromScore)})`} aria-label="Reprendre l'instrument de la partition">
                    ↺
                  </button>
                )}
              </span>
            );
            // le volume de la partie : un réglage fin, pour équilibrer les parties (un double-clic le remet à 0)
            const db = volumes[i] ?? 0;
            const volume = (
              <label className="inline-flex items-center gap-1 text-muted text-[12px] cursor-pointer whitespace-nowrap" title="Le volume de la partie à l'écoute, pour ce morceau (double-clic : tel quel)">
                <input className="w-[72px] accent-accent" type="range" min={MIN_VOLUME} max={MAX_VOLUME} step={1} value={db} onChange={(e) => onVolume(i, Number(e.target.value))} onDoubleClick={() => onVolume(i, 0)} aria-label={`Volume${g.name ? ` : ${g.name}` : ""}`} />
                <output className="min-w-[3.6em] text-right tabular-nums">{db > 0 ? `+${db}` : db < 0 ? `−${-db}` : "0"} dB</output>
              </label>
            );
            // une partie d'une portée : une seule ligne ; sinon son nom et son instrument, puis ses portées
            if (g.staves.length === 1)
              return (
                <div key={i} className={ROW}>
                  <PopoverCheck checked={!muted.includes(g.staves[0].k)} onChange={() => toggle(g.staves[0].k)}>
                    {g.staves[0].label}
                  </PopoverCheck>
                  {instrument}
                  {volume}
                </div>
              );
            return (
              <div key={i} className="grid gap-1">
                <div className={ROW}>
                  <span className="font-semibold">{g.name || "Partie"}</span>
                  {instrument}
                  {volume}
                </div>
                {g.staves.map((p) => (
                  <PopoverCheck key={p.k} className="pl-3.5" checked={!muted.includes(p.k)} onChange={() => toggle(p.k)}>
                    {p.label}
                  </PopoverCheck>
                ))}
              </div>
            );
          })}
          <div className="flex gap-1.5 mt-1">
            <button className={ACTION} onClick={() => onMuted([])} disabled={!muted.length}>
              Toutes
            </button>
            <button className={ACTION} onClick={() => onMuted(all)} disabled={silent}>
              Aucune
            </button>
          </div>
          <PopoverHint>Une portée muette n'est pas jouée : à vous de la jouer, avec le métronome au besoin. L'instrument d'une partie est celui que la partition écrit après son nom, ou que son nom fait deviner ; un autre choix, comme le volume, vaut pour ce morceau.</PopoverHint>
        </Popover>
      )}
    </span>
  );
}
